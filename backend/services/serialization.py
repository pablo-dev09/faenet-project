"""Batch public payloads without hydrating social graphs or caching private state.

All aggregates are scoped to the objects in this response. Nothing is attached to
ORM instances or shared across requests/viewers, so mutations remain immediately
visible and saved/liked flags cannot leak between sessions.
"""
from sqlalchemy import case, func, select

from ..extensions import db
from ..models import Comment, followers, post_likes, post_reposts, post_saves


def serialize_users(users):
    users = list(users)
    ids = {u.username for u in users}
    if not ids:
        return []
    counts = {key: {"followers_count": 0, "following_count": 0} for key in ids}
    for column, field in ((followers.c.followed_id, "followers_count"),
                          (followers.c.follower_id, "following_count")):
        rows = db.session.execute(
            select(column, func.count()).where(column.in_(ids)).group_by(column)
        )
        for username, count in rows:
            counts[username][field] = count
    return [u.to_public_dict(counts=counts[u.username]) for u in users]


def serialize_posts(posts, viewer=None, *, include_original=True):
    posts = list(posts)
    if not posts:
        return []
    all_posts = {p.id: p for p in posts}
    if include_original:
        all_posts.update({p.original.id: p.original for p in posts if p.repost_of and p.original})
    authors = {p.author.username: p.author for p in all_posts.values() if p.author}
    author_data = {u["username"]: u for u in serialize_users(authors.values())}
    viewer_id = viewer.username if viewer else None
    metrics = {key: {"likes_count": 0, "saves_count": 0, "reposts_count": 0,
                     "comments_count": 0, "author": author_data.get(p.username)}
               for key, p in all_posts.items()}
    for table, count_field, flag in (
        (post_likes, "likes_count", "liked_by_me"),
        (post_saves, "saves_count", "saved_by_me"),
        (post_reposts, "reposts_count", "reposted_by_me"),
    ):
        if viewer_id:
            for data in metrics.values():
                data[flag] = False
        rows = db.session.execute(
            select(table.c.post_id, func.count(),
                   func.max(case((table.c.user_id == viewer_id, 1), else_=0)))
            .where(table.c.post_id.in_(all_posts)).group_by(table.c.post_id)
        )
        for post_id, count, mine in rows:
            metrics[post_id][count_field] = count
            if viewer_id:
                metrics[post_id][flag] = bool(mine)
    for post_id, count in db.session.execute(
        select(Comment.post_id, func.count()).where(Comment.post_id.in_(all_posts)).group_by(Comment.post_id)
    ):
        metrics[post_id]["comments_count"] = count
    result = []
    for post in posts:
        data = post.to_dict(current_user=viewer_id, relations=metrics[post.id])
        if include_original and post.repost_of and post.original:
            data["repost_of_data"] = post.original.to_dict(
                current_user=viewer_id, relations=metrics[post.original.id])
        result.append(data)
    return result
