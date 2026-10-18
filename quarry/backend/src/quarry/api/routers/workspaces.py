"""Named workspace layouts (desktop dockview JSON or tablet pane assignments)."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Path, Query, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert

from quarry.api.deps import Session
from quarry.core.errors import NotFoundError
from quarry.storage.models import CommandHistory, WorkspaceLayout

router = APIRouter(tags=["workspaces"])

FormFactor = Literal["desktop", "tablet"]
WorkspaceName = Annotated[str, Path(pattern=r"^[A-Za-z0-9][A-Za-z0-9 _\-]{0,63}$")]
MAX_LAYOUT_BYTES = 256 * 1024


class LayoutIn(BaseModel):
    layout: dict[str, Any]

    @field_validator("layout")
    @classmethod
    def _size_cap(cls, v: dict[str, Any]) -> dict[str, Any]:
        if len(json.dumps(v)) > MAX_LAYOUT_BYTES:
            raise ValueError("layout too large")
        return v


class LayoutOut(BaseModel):
    name: str
    form_factor: FormFactor
    layout: dict[str, Any]
    updated_at: datetime


class WorkspaceSummary(BaseModel):
    name: str
    form_factor: FormFactor
    updated_at: datetime


@router.get("/workspaces", response_model=list[WorkspaceSummary])
async def list_workspaces(
    session: Session, form_factor: FormFactor = "desktop"
) -> list[WorkspaceSummary]:
    rows = await session.scalars(
        select(WorkspaceLayout)
        .where(WorkspaceLayout.form_factor == form_factor)
        .order_by(WorkspaceLayout.name)
    )
    return [
        WorkspaceSummary(name=r.name, form_factor=form_factor, updated_at=r.updated_at)
        for r in rows
    ]


@router.get("/workspaces/{name}", response_model=LayoutOut)
async def get_workspace(
    name: WorkspaceName, session: Session, form_factor: FormFactor = "desktop"
) -> LayoutOut:
    row = await session.get(WorkspaceLayout, (name, form_factor))
    if row is None:
        raise NotFoundError(f"workspace {name!r} not found")
    return LayoutOut(
        name=row.name, form_factor=form_factor, layout=row.layout, updated_at=row.updated_at
    )


@router.put("/workspaces/{name}", response_model=LayoutOut)
async def save_workspace(
    name: WorkspaceName, body: LayoutIn, session: Session, form_factor: FormFactor = "desktop"
) -> LayoutOut:
    stmt = (
        insert(WorkspaceLayout)
        .values(name=name, form_factor=form_factor, layout=body.layout)
        .on_conflict_do_update(
            index_elements=["name", "form_factor"],
            set_={"layout": body.layout, "updated_at": func.now()},
        )
        .returning(WorkspaceLayout.updated_at)
    )
    updated_at = (await session.execute(stmt)).scalar_one()
    await session.commit()
    return LayoutOut(name=name, form_factor=form_factor, layout=body.layout, updated_at=updated_at)


@router.delete("/workspaces/{name}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workspace(
    name: WorkspaceName, session: Session, form_factor: FormFactor = "desktop"
) -> None:
    await session.execute(
        delete(WorkspaceLayout).where(
            WorkspaceLayout.name == name, WorkspaceLayout.form_factor == form_factor
        )
    )
    await session.commit()


class CommandIn(BaseModel):
    command: str = Field(min_length=1, max_length=200)


class CommandOut(BaseModel):
    command: str
    executed_at: datetime


@router.post("/history", response_model=CommandOut, status_code=status.HTTP_201_CREATED)
async def add_history(body: CommandIn, session: Session) -> CommandOut:
    row = CommandHistory(command=body.command.strip())
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return CommandOut(command=row.command, executed_at=row.executed_at)


@router.get("/history", response_model=list[CommandOut])
async def recent_history(
    session: Session, limit: Annotated[int, Query(ge=1, le=200)] = 50
) -> list[CommandOut]:
    rows = await session.scalars(
        select(CommandHistory).order_by(CommandHistory.executed_at.desc()).limit(limit)
    )
    return [CommandOut(command=r.command, executed_at=r.executed_at) for r in rows]
