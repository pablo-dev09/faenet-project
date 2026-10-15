"""Isolated regression/query-budget tests. Never connect to the live database."""
import os
import unittest
from contextlib import contextmanager
from datetime import datetime, timedelta

os.environ["FLASK_ENV"] = "testing"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["SECRET_KEY"] = "isolated-performance-tests-only"

from sqlalchemy import event, inspect
from backend.app import app
from backend.extensions import db
from backend.models import (User, Post, Comment, Story, Message, followers,
                            post_likes, post_saves, post_reposts, story_viewers)
from backend.services import post_service, user_service, story_service, message_service


@contextmanager
def queries():
    statements = []
    def record(conn, cursor, statement, parameters, context, executemany):
        if statement.lstrip().upper().startswith(("SELECT", "WITH")):
            statements.append(statement)
    event.listen(db.engine, "before_cursor_execute", record)
    try:
        yield statements
    finally:
        event.remove(db.engine, "before_cursor_execute", record)


class PerformanceTests(unittest.TestCase):
    def setUp(self):
        self.context = app.app_context()
        self.context.push()
        self.assertEqual(str(db.engine.url), "sqlite:///:memory:")
        db.create_all()
        now = datetime(2026, 1, 1, 12)
        db.session.add(User(username="viewer", name="Test Viewer", password_hash="unused"))
        for i in range(30):
            username = f"author{i:02}"
            db.session.add(User(username=username, name=f"Author {i}", password_hash="unused"))
        db.session.flush()
        for i in range(30):
            username = f"author{i:02}"
            post = Post(id=f"p{i:02}", username=username, content=f"Post {i}",
                        timestamp=now + timedelta(minutes=i))
            post.images = [f"/uploads/posts/{i}.webp"]
            if i == 5:
                post.poll = {"question": "Test?", "options": [{"text": "Yes", "votes": 0}]}
            db.session.add(post)
            db.session.add(Comment(id=f"c{i:02}", post_id=post.id, username=username, content="Test"))
        db.session.flush()
        for table in (post_likes, post_saves, post_reposts):
            db.session.execute(table.insert(), [dict(user_id="viewer", post_id=f"p{i:02}") for i in (0, 5, 29)])
        db.session.execute(followers.insert(), [dict(follower_id="viewer", followed_id=f"author{i:02}") for i in (0, 5)])
        db.session.add(Post(id="repost", username="viewer", content="Repost", repost_of="p05", timestamp=now + timedelta(days=1)))
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.context.pop()

    def fresh_viewer(self):
        db.session.remove()
        return db.session.get(User, "viewer")

    def test_feed_budget_and_legacy_payload(self):
        viewer = self.fresh_viewer()
        posts = Post.query.order_by(Post.timestamp.desc()).limit(30).all()
        expected = []
        for post in posts:
            data = post.to_dict(current_user="viewer")
            if post.original:
                data["repost_of_data"] = post.original.to_dict(current_user="viewer")
            expected.append(data)
        viewer = self.fresh_viewer()
        with queries() as statements:
            actual = post_service.list_feed(viewer, limit=30, scope="all")
        print(f"feed/30 SQL statements: {len(statements)}")
        self.assertEqual(expected, actual)
        self.assertLessEqual(len(statements), 8)

    def test_following_scope_includes_self_and_paginates(self):
        viewer = self.fresh_viewer()
        data = post_service.list_feed(viewer, scope="following")
        self.assertEqual([p["id"] for p in data], ["repost", "p05", "p00"])
        self.assertEqual(post_service.list_feed(viewer, limit=1, offset=1)[0]["id"], "p05")

    def test_saved_posts_only_for_viewer(self):
        viewer = self.fresh_viewer()
        with queries() as statements:
            data = post_service.list_saved_posts(viewer)
        self.assertEqual([p["id"] for p in data], ["p29", "p05", "p00"])
        self.assertTrue(all(p["saved_by_me"] for p in data))
        self.assertLessEqual(len(statements), 8)

    def test_anonymous_user_posts_contract(self):
        post = db.session.get(Post, "p05")
        expected = post.to_dict()
        db.session.remove()
        self.assertEqual([expected], post_service.list_user_posts(None, "author05"))

    def test_search_budget_and_payload(self):
        expected = [u.to_public_dict() for u in User.query.filter(User.username.like("author%")).order_by(User.username).all()]
        viewer = self.fresh_viewer()
        with queries() as statements:
            actual = user_service.search_users(viewer, "author", limit=30)
        print(f"search/30 SQL statements: {len(statements)}")
        self.assertEqual(expected, actual)
        self.assertLessEqual(len(statements), 3)

    def test_suggestions_exclude_self_and_followed(self):
        viewer = self.fresh_viewer()
        with queries() as statements:
            result = user_service.suggest_users(viewer, limit=30)
        self.assertEqual(len(result), 28)
        self.assertFalse({"viewer", "author00", "author05"} & {u["username"] for u in result})
        self.assertLessEqual(len(statements), 3)

    def test_empty_pages_do_not_query_relations(self):
        viewer = self.fresh_viewer()
        with queries() as statements:
            result = post_service.list_feed(viewer, offset=1000, scope="all")
        self.assertEqual(result, [])
        self.assertEqual(len(statements), 1)

    def test_comments_batch_authors(self):
        for i in range(15):
            db.session.add(Comment(post_id="p00", username=f"author{i:02}", content="Another"))
        db.session.commit()
        expected = [c.to_dict() for c in db.session.get(Post, "p00").comments]
        db.session.remove()
        with queries() as statements:
            actual = post_service.list_comments(post_id="p00")
        self.assertEqual(expected, actual)
        self.assertLessEqual(len(statements), 4)

    def test_reactions_refresh_without_cross_viewer_state(self):
        viewer = self.fresh_viewer()
        post_service.toggle_like(viewer=viewer, post_id="p05")
        data = post_service.list_user_posts(viewer, "author05")[0]
        self.assertFalse(data["liked_by_me"])
        self.assertEqual(data["likes_count"], 0)
        post_service.toggle_like(viewer=viewer, post_id="p05")
        self.assertTrue(post_service.list_user_posts(viewer, "author05")[0]["liked_by_me"])
        stranger = db.session.get(User, "author00")
        data = post_service.list_user_posts(stranger, "author05")[0]
        self.assertFalse(data["liked_by_me"])
        self.assertFalse(data["saved_by_me"])
        self.assertEqual(data["likes_count"], 1)
        self.assertEqual(data["saves_count"], 1)

    def test_stories_filter_expiry_following_and_batch(self):
        now = datetime.utcnow()
        for i in range(30):
            db.session.add(Story(id=f"s{i:02}", username=f"author{i:02}", image=f"/{i}.png", timestamp=now - timedelta(seconds=i)))
        db.session.add(Story(id="own", username="viewer", image="/own.png", timestamp=now + timedelta(seconds=1)))
        db.session.add(Story(id="expired", username="author00", image="/old.png", timestamp=now - timedelta(hours=25)))
        db.session.flush()
        db.session.execute(story_viewers.insert().values(user_id="viewer", story_id="s00"))
        db.session.commit()
        stories = Story.query.filter(Story.id.in_(["own", "s00", "s05"])).order_by(Story.timestamp.desc()).all()
        expected = [s.to_dict(current_user="viewer") for s in stories]
        viewer = self.fresh_viewer()
        with queries() as statements:
            actual = story_service.list_active(viewer)
        self.assertEqual(expected, actual)
        self.assertLessEqual(len(statements), 4)

    def test_conversations_summary_and_privacy(self):
        now = datetime(2026, 1, 2)
        for i in range(15):
            for j in range(10):
                db.session.add(Message(id=f"m{i:02}{j}", from_user=f"author{i:02}" if j % 2 else "viewer",
                    to_user="viewer" if j % 2 else f"author{i:02}", text=f"message {j}", read=(j == 1),
                    timestamp=now + timedelta(minutes=i, seconds=j)))
        db.session.add(Message(id="private", from_user="author20", to_user="author21", text="not yours", timestamp=now + timedelta(days=1)))
        db.session.commit()
        expected = []
        for i in reversed(range(15)):
            expected.append({"with": db.session.get(User, f"author{i:02}").to_public_dict(),
                             "last_message": db.session.get(Message, f"m{i:02}9").to_dict(), "unread_count": 4})
        viewer = self.fresh_viewer()
        with queries() as statements:
            actual = message_service.list_conversations(viewer)
        print(f"conversations/15 SQL statements: {len(statements)}")
        self.assertEqual(expected, actual)
        self.assertLessEqual(len(statements), 3)

    def test_mark_read_refreshes_summary(self):
        db.session.add(Message(id="incoming", from_user="author00", to_user="viewer", text="Hello"))
        db.session.commit()
        viewer = self.fresh_viewer()
        self.assertEqual(message_service.list_conversations(viewer)[0]["unread_count"], 1)
        self.assertEqual(message_service.mark_thread_read(viewer, "author00"), 1)
        self.assertEqual(message_service.list_conversations(viewer)[0]["unread_count"], 0)
        self.assertEqual(message_service.list_conversations(db.session.get(User, "author29")), [])

    def test_page_size_does_not_increase_query_count(self):
        counts = []
        for size in (1, 10, 30, 100):
            viewer = self.fresh_viewer()
            with queries() as statements:
                result = post_service.list_feed(viewer, scope="all", limit=size)
            self.assertEqual(len(result), min(size, 31))
            counts.append(len(statements))
            for obj in db.session.identity_map.values():
                if isinstance(obj, Post):
                    self.assertTrue({"liked_by", "saved_by", "reposted_by", "comments"} <= inspect(obj).unloaded)
                elif isinstance(obj, User):
                    self.assertTrue({"followers", "followed"} <= inspect(obj).unloaded)
        self.assertEqual(counts, [7, 7, 7, 7])

    def test_api_read_and_mutation_flow(self):
        viewer = db.session.get(User, "viewer")
        viewer.set_password("local-test-only-123")
        db.session.commit()
        client = app.test_client()
        response = client.post("/api/auth/login", json={"username": "viewer", "password": "local-test-only-123"})
        self.assertEqual(response.status_code, 200)
        for path in ("/api/posts?scope=all", "/api/posts?limit=invalid", "/api/users?q=author",
                     "/api/users/suggestions", "/api/messages", "/api/stories", "/api/me"):
            with self.subTest(path=path):
                response = client.get(path)
                self.assertEqual(response.status_code, 200)
                self.assertTrue(response.json["ok"])
        self.assertEqual(client.get("/api/posts/missing").status_code, 404)
        original = client.get("/api/posts/p05").json["data"]
        self.assertEqual(original["likes_count"], 1)
        self.assertEqual(client.post("/api/posts/p05/like").json["data"], {"liked": False, "likes_count": 0})
        self.assertFalse(client.get("/api/posts/p05").json["data"]["liked_by_me"])
        for action, flag, count in (("save", "saved", "saves_count"), ("repost", "reposted", "reposts_count")):
            response = client.post(f"/api/posts/p05/{action}")
            self.assertEqual(response.json["data"], {flag: False, count: 0})
        new = client.post("/api/posts", json={"content": "Isolated test post"})
        self.assertEqual(new.status_code, 201)
        self.assertEqual(new.json["data"]["author"]["username"], "viewer")
        self.assertNotIn("repost_of_data", client.get("/api/posts/repost").json["data"])
        comment = client.post("/api/posts/p05/comment", json={"content": "Test comment"})
        self.assertEqual(comment.status_code, 201)
        self.assertEqual(client.get("/api/posts/p05").json["data"]["comments_count"], 2)
        self.assertEqual(client.delete("/api/posts/p05").status_code, 403)
        self.assertEqual(client.delete(f"/api/posts/{new.json['data']['id']}").status_code, 200)

    def test_follower_counts_refresh_after_changes(self):
        viewer = self.fresh_viewer()
        data = user_service.get_profile(viewer, "author01")
        self.assertFalse(data["is_following"])
        user_service.follow_user(viewer, "author01")
        data = user_service.get_profile(viewer, "author01")
        self.assertTrue(data["is_following"])
        self.assertEqual(data["followers_count"], 1)
        user_service.unfollow_user(viewer, "author01")
        data = user_service.get_profile(viewer, "author01")
        self.assertFalse(data["is_following"])
        self.assertEqual(data["followers_count"], 0)

    def test_story_view_refreshes_and_other_viewer_is_isolated(self):
        db.session.add(Story(id="fresh", username="author00", image="/test.png"))
        db.session.commit()
        viewer = self.fresh_viewer()
        self.assertFalse(story_service.list_active(viewer)[0]["viewed_by_me"])
        story_service.mark_viewed(viewer=viewer, story_id="fresh")
        story_service.mark_viewed(viewer=viewer, story_id="fresh")
        data = story_service.list_active(viewer)[0]
        self.assertEqual(data["views_count"], 1)
        self.assertTrue(data["viewed_by_me"])
        data = story_service.list_active(db.session.get(User, "author00"))[0]
        self.assertFalse(data["viewed_by_me"])
        self.assertEqual(data["views_count"], 1)

    def test_same_timestamp_conversations_are_deterministic(self):
        now = datetime(2026, 1, 3)
        for key in ("a", "b"):
            db.session.add(Message(id=key, from_user="author00", to_user="viewer", text=key, timestamp=now))
        db.session.commit()
        data = message_service.list_conversations(self.fresh_viewer())
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["last_message"]["id"], "b")
        self.assertEqual(data[0]["unread_count"], 2)

    def test_feed_without_following_and_deleted_original(self):
        viewer = self.fresh_viewer()
        db.session.execute(followers.delete().where(followers.c.follower_id == "viewer"))
        post = db.session.get(Post, "repost")
        post.repost_of = None
        db.session.commit()
        data = post_service.list_feed(viewer)
        self.assertEqual([p["id"] for p in data], ["repost"])
        self.assertNotIn("repost_of_data", data[0])

    def test_conversations_hydrate_only_latest_messages(self):
        now = datetime(2026, 1, 4)
        for i in range(200):
            db.session.add(Message(id=f"history{i:03}", from_user="viewer", to_user="author00",
                                   text="Old history", timestamp=now + timedelta(seconds=i)))
        db.session.commit()
        data = message_service.list_conversations(self.fresh_viewer())
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["last_message"]["id"], "history199")
        self.assertLessEqual(sum(isinstance(obj, Message) for obj in db.session.identity_map.values()), 1)

    def test_full_hundred_item_page_has_constant_budget(self):
        for i in range(100):
            username = f"scale{i:03}"
            db.session.add(User(username=username, name=f"Scale User {i}", password_hash="unused"))
        db.session.flush()
        for i in range(100):
            db.session.add(Post(id=f"scale{i:03}", username=f"scale{i:03}", content="Scale test",
                                timestamp=datetime(2026, 2, 1) + timedelta(seconds=i)))
        db.session.commit()
        viewer = self.fresh_viewer()
        with queries() as statements:
            data = post_service.list_feed(viewer, limit=100, scope="all")
        self.assertEqual(len(data), 100)
        self.assertEqual(len({p["author"]["username"] for p in data}), 100)
        self.assertEqual(len(statements), 7)

    def test_anonymous_api_access_stays_blocked(self):
        client = app.test_client()
        for path in ("/api/posts", "/api/messages", "/api/me"):
            with self.subTest(path=path):
                self.assertEqual(client.get(path).status_code, 401)

    def test_spa_shell_needs_no_database(self):
        client = app.test_client()
        with queries() as statements:
            for path in ("/", "/feed", "/messages", "/explore", "/faemap"):
                response = client.get(path)
                self.assertEqual(response.status_code, 200)
                self.assertIn(b"<!DOCTYPE html>", response.data)
                response.close()
        self.assertEqual(statements, [])


if __name__ == "__main__":
    unittest.main()
