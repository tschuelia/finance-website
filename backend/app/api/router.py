from fastapi import APIRouter

from app.api.accounts import router as accounts_router
from app.api.auth import router as auth_router
from app.api.categories import router as categories_router
from app.api.contracts import router as contracts_router
from app.api.dashboard import router as dashboard_router
from app.api.imports import router as imports_router
from app.api.review import router as review_router
from app.api.transactions import router as transactions_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(accounts_router)
# Import routes must be registered before the dynamic transaction detail route,
# otherwise the literal "import" segment is interpreted as a transaction ID.
api_router.include_router(imports_router)
api_router.include_router(review_router)
api_router.include_router(transactions_router)
api_router.include_router(categories_router)
api_router.include_router(contracts_router)
api_router.include_router(dashboard_router)
