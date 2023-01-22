from django.urls import path, include

from .views import (
    transactions_overview,
    accounts_view,
    categories_view,
    create_category,
    update_category,
    transaction_detail_view,
    transaction_update_view,
    transaction_upload_csv_view,
    transactions_add_multiple,
    CategoryCreateView,
    reassign_categories,
    charts_view,
)


urlpatterns = [
    # Account views
    path("", accounts_view, name="accounts"),
    path("konto/<int:pk>/", transactions_overview, name="transactions"),
    path(
        "konto/<int:pk>/upload",
        transaction_upload_csv_view,
        name="upload-transactions-csv",
    ),
    path(
        "konto/<int:pk>/addmulti",
        transactions_add_multiple,
        name="transaction-multi-add",
    ),
    path(
        "konto/<int:pk>/updatecategories",
        reassign_categories,
        name="reassign-categories",
    ),
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
    path("konto/<int:pk>/charts", charts_view, name="account-charts"),
    # Category views
    path("kategorien", categories_view, name="categories"),
    path("kategorien/new", create_category, name="create-category"),
    path("kategorien/<int:pk>/update", update_category, name="update-category"),
    path(
        "kategorien/popup/new",
        CategoryCreateView.as_view(),
        name="create-category-popup",
    ),
    # Charts
    path("dash-charts/", include("django_plotly_dash.urls")),
    path("charts/", charts_view, name="charts")
]
