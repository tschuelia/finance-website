from django.urls import path

from .views import (
    transactions_view,
    accounts_view,
    create_category,
    transaction_detail_view,
    transaction_update_view,
    CategoryCreateView,
)

urlpatterns = [
    path("", accounts_view, name="accounts"),
    path("konto/<int:pk>/", transactions_view, name="transactions"),
    path(
        "konto/<int:acc_pk>/transaction/<int:t_pk>",
        transaction_detail_view,
        name="transaction-detail",
    ),
    path(
        "konto/<int:acc_pk>/transaction/<int:t_pk>/update",
        transaction_update_view,
        name="transaction-update",
    ),
    path("kategorien/new", create_category, name="create-category"),
    path(
        "kategorien/popup/new",
        CategoryCreateView.as_view(),
        name="create-category-popup",
    ),
]
