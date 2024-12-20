from django.urls import include, path

from .views import (
    CategoryCreateView,
    accounts_view,
    add_files_to_contract,
    categories_view,
    charts_view,
    contract_detail_view,
    contracts_view,
    create_category,
    create_contract,
    depot_asset_update_view,
    depot_overview,
    reassign_categories,
    transaction_delete_view,
    transaction_detail_view,
    transaction_update_view,
    transaction_upload_csv_view,
    transactions_add_multiple,
    transactions_overview,
    update_category,
    update_contract,
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
    path(
        "konto/<int:acc_pk>/transaction/<int:t_pk>/delete",
        transaction_delete_view,
        name="transaction-delete",
    ),
    path("konto/<int:pk>/charts", charts_view, name="account-charts"),
    # Depot views
    path("depot/<int:pk>/", depot_overview, name="depot-detail"),
    path(
        "depot/<int:dep_pk>/asset/<int:as_pk>/update",
        depot_asset_update_view,
        name="depot-asset-update",
    ),
    # Category views
    path("kategorien", categories_view, name="categories"),
    path("kategorien/new", create_category, name="create-category"),
    path("kategorien/<int:pk>/update", update_category, name="update-category"),
    path(
        "kategorien/popup/new",
        CategoryCreateView.as_view(),
        name="create-category-popup",
    ),
    # Contract views
    path("vertrag", contracts_view, name="contracts"),
    path("vertrag/<int:pk>", contract_detail_view, name="contract-detail"),
    path("vertrag/new", create_contract, name="create-contract"),
    path("vertrag/<int:pk>/update", update_contract, name="update-contract"),
    path(
        "vertrag/<int:pk>/addfiles", add_files_to_contract, name="add-files-to-contract"
    ),
    # Charts
    path("dash-charts/", include("django_plotly_dash.urls")),
    path("charts/", charts_view, name="charts"),
]
