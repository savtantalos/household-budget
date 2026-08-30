"""Generic CRUD router factory shared by every budget resource."""

from typing import TypeVar

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from .db import get_session

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
) -> APIRouter:
    router = APIRouter(prefix=prefix, tags=[tag])

    def load(session: Session, item_id: int) -> TableT:
        item = session.get(model, item_id)
        if item is None:
            raise HTTPException(status_code=404, detail=f"{tag} {item_id} not found")
        return item

    @router.get("", response_model=list[model])
    def list_items(session: Session = Depends(get_session)) -> list[TableT]:
        return list(session.exec(select(model)).all())

    @router.post("", response_model=model, status_code=201)
    def create_item(
        payload: create_model,  # type: ignore[valid-type]
        session: Session = Depends(get_session),
    ) -> TableT:
        item = model(**payload.model_dump(exclude_unset=True))
        session.add(item)
        session.commit()
        session.refresh(item)
        return item

    @router.patch("/{item_id}", response_model=model)
    def update_item(
        item_id: int,
        payload: update_model,  # type: ignore[valid-type]
        session: Session = Depends(get_session),
    ) -> TableT:
        item = load(session, item_id)
        for key, value in payload.model_dump(exclude_unset=True).items():
            setattr(item, key, value)
        session.add(item)
        session.commit()
        session.refresh(item)
        return item

    @router.delete("/{item_id}", status_code=204)
    def delete_item(item_id: int, session: Session = Depends(get_session)) -> None:
        session.delete(load(session, item_id))
        session.commit()

    return router
