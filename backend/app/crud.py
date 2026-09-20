"""Generic CRUD router factory shared by every budget resource."""

from collections.abc import Callable
from typing import TypeVar

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from .auth import get_current_user
from .db import get_session
from .models import User

TableT = TypeVar("TableT")
CreateT = TypeVar("CreateT")
UpdateT = TypeVar("UpdateT")


def crud_router(
    *,
    model: type[TableT],
    create_model: type[CreateT],
    update_model: type[UpdateT],
    prefix: str,
    tag: str,
    pre_delete: "Callable[[Session, TableT], None] | None" = None,
) -> APIRouter:
    router = APIRouter(prefix=prefix, tags=[tag])

    def load(session: Session, item_id: int, user: User) -> TableT:
        item = session.get(model, item_id)
        if item is None or item.user_id != user.id:
            raise HTTPException(status_code=404, detail=f"{tag} {item_id} not found")
        return item

    @router.get("", response_model=list[model])
    def list_items(
        session: Session = Depends(get_session),
        user: User = Depends(get_current_user),
    ) -> list[TableT]:
        return list(session.exec(select(model).where(model.user_id == user.id)).all())

    @router.post("", response_model=model, status_code=201)
    def create_item(
        payload: create_model,  # type: ignore[valid-type]
        session: Session = Depends(get_session),
        user: User = Depends(get_current_user),
    ) -> TableT:
        item = model(user_id=user.id, **payload.model_dump(exclude_unset=True))
        session.add(item)
        session.commit()
        session.refresh(item)
        return item

    @router.patch("/{item_id}", response_model=model)
    def update_item(
        item_id: int,
        payload: update_model,  # type: ignore[valid-type]
        session: Session = Depends(get_session),
        user: User = Depends(get_current_user),
    ) -> TableT:
        item = load(session, item_id, user)
        for key, value in payload.model_dump(exclude_unset=True).items():
            setattr(item, key, value)
        session.add(item)
        session.commit()
        session.refresh(item)
        return item

    @router.delete("/{item_id}", status_code=204)
    def delete_item(
        item_id: int,
        session: Session = Depends(get_session),
        user: User = Depends(get_current_user),
    ) -> None:
        item = load(session, item_id, user)
        if pre_delete is not None:
            pre_delete(session, item)
        session.delete(item)
        session.commit()

    return router
