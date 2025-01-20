from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.models import User
from django.core.paginator import Paginator
from django.shortcuts import get_object_or_404, redirect, render
from django.views.generic import CreateView
from django_addanother.views import CreatePopupMixin

from . import charts  # noqa: F401
from .csv_to_transactions import csv_to_transactions
from .forms import (
    AssetForm,
    CategoryForm,
    ContractFileFormSet,
    ContractForm,
    FilterTransactionsForm,
    TransactionForm,
    TransactionFormSet,
    UploadFileForm,
    process_transactions_formset,
)
from .models import (
    BankAccount,
    BankDepot,
    Category,
    Contract,
    DepotAsset,
    Transaction,
    check_user_permissions,
    get_balance_for_user_owned_accounts,
    get_bank_accounts_for_user,
    get_bank_depots_for_user,
    get_contracts_for_user,
    update_transaction_categories_for_account,
)

TRANSACTIONS_PAGE_LIMIT = 100


#################################
# Overview of Bank Accounts
#################################


def accounts_view(request):
    """
    Display all bank accounts the user is allowed to view
    """
    user = request.user
    users_and_accounts = {}
    total_balance = 0
    if user.is_superuser:
        all_users = User.objects.all()
        accounts = get_bank_accounts_for_user(user)
        depots = get_bank_depots_for_user(user)

        for user in all_users:
            balance = get_balance_for_user_owned_accounts(user)
            users_and_accounts[user] = (
                accounts.filter(owner=user),
                depots.filter(owner=user),
                balance,
            )
            total_balance += balance
    else:
        accounts = get_bank_accounts_for_user(request.user)
        depots = get_bank_depots_for_user(request.user)
        balance = get_balance_for_user_owned_accounts(request.user)
        total_balance = balance
        users_and_accounts[request.user] = (accounts, depots, balance)

    context = {"users_and_accounts": users_and_accounts, "total_balance": total_balance}
    return render(request, "accounting/bank_accounts.html", context)


#################################
# Bank Account specific views
#################################
def transactions_overview(request, pk):
    """
    Overview of all transactions for a bank account
    """
    account = get_object_or_404(BankAccount, pk=pk)
    check_user_permissions(request.user, account)

    filter_form = FilterTransactionsForm(request.GET)

    transactions = account.get_transactions(
        search_term=request.GET.get("q"),
        date_start=request.GET.get("date_start"),
        date_end=request.GET.get("date_end"),
        amount_min=request.GET.get("amount_min"),
        amount_max=request.GET.get("amount_max"),
        categories=request.GET.getlist("categories"),
    )

    paginator = Paginator(transactions, TRANSACTIONS_PAGE_LIMIT)
    current_page = request.GET.get("page")
    page_obj = paginator.get_page(current_page)

    context = {
        "account": account,
        "transactions": transactions,
        "page_obj": page_obj,
        "form": filter_form,
    }

    # Only add received/payed summary to the context if any filters were applied
    # Without filters, the total amount will differ from the account balance since the account was started with an
    # initial amount set. This might confuse the user.
    if any(v for v in request.GET.values()):
        transaction_amounts = [t.amount for t in transactions]
        total = sum(transaction_amounts)
        payed = sum([t for t in transaction_amounts if t < 0])
        received = sum([t for t in transaction_amounts if t > 0])

        dates = [t.date_issue for t in transactions]
        min_date = min(dates) if dates else None
        max_date = max(dates) if dates else None

        context.update(
            {
                "total_amount": total,
                "payed_amount": payed,
                "received_amount": received,
                "min_date": min_date,
                "max_date": max_date,
            }
        )

    return render(request, "accounting/bank_account_detail.html", context)


#################################
# Transaction specific views
#################################
def transactions_add_multiple(request, pk):
    """
    View that allows table based adding of multiple transactions to the bank account
    """
    account = get_object_or_404(BankAccount, pk=pk)
    check_user_permissions(request.user, account)

    if request.method == "POST":
        transactions_formset = TransactionFormSet(
            request.POST, request.FILES, form_kwargs={"user": request.user}
        )
        if not transactions_formset.is_valid():
            return render(
                request,
                "accounting/transaction_formset.html",
                {"formset": transactions_formset, "account": account},
            )

        n_added_transactions = process_transactions_formset(
            transactions_formset, account
        )
        if n_added_transactions > 0:
            messages.add_message(
                request, messages.INFO, f"{n_added_transactions} transactions added."
            )

        return redirect("transactions", pk=pk)

    else:
        transactions_formset = TransactionFormSet(form_kwargs={"user": request.user})
        return render(
            request,
            "accounting/transaction_formset.html",
            {"formset": transactions_formset, "account": account},
        )


def transaction_upload_csv_view(request, pk):
    """
    View that allows uploading a csv export containing transaction information
    """
    account = get_object_or_404(BankAccount, pk=pk)
    check_user_permissions(request.user, account)

    if request.method == "POST":
        form = UploadFileForm(request.POST, request.FILES)
        if form.is_valid():
            # # parse the csv file into a list of dictionaries containing all transactions
            transactions = csv_to_transactions(request.FILES["file"], account)
            # # display the transactions and allow modifications before saving them to the database
            transactions_formset = TransactionFormSet(
                initial=transactions, form_kwargs={"user": request.user}
            )
            return render(
                request,
                "accounting/transaction_formset.html",
                {"formset": transactions_formset, "account": account},
            )
    else:
        form = UploadFileForm()
    return render(request, "accounting/transaction_upload_form.html", {"form": form})


def transaction_detail_view(request, acc_pk, t_pk):
    """
    Show details of the selected transaction
    """
    account = get_object_or_404(BankAccount, pk=acc_pk)
    check_user_permissions(request.user, account)

    transaction = get_object_or_404(Transaction, pk=t_pk)

    context = {
        "account": account,
        "transaction": transaction,
    }
    return render(request, "accounting/transaction_detail.html", context)


def display_transaction_form(request, transaction=None):
    transaction_form = TransactionForm(instance=transaction, user=request.user)
    return render(
        request,
        "accounting/transaction_form.html",
        {
            "form": transaction_form,
        },
    )


def process_transaction_form(request, transaction=None):
    transaction_form = TransactionForm(
        request.POST, instance=transaction, user=request.user
    )
    if not transaction_form.is_valid():
        return render(
            request,
            "accounting/transaction_form.html",
            {
                "form": transaction_form,
            },
        )

    transaction_obj = transaction_form.save()

    return redirect(
        "transaction-detail",
        acc_pk=transaction_obj.bank_account.pk,
        t_pk=transaction_obj.pk,
    )


def transaction_update_view(request, acc_pk, t_pk):
    """
    Update a transaction object
    """
    account = get_object_or_404(BankAccount, pk=acc_pk)
    check_user_permissions(request.user, account)

    transaction = get_object_or_404(Transaction, pk=t_pk)
    if request.method == "GET":
        return display_transaction_form(request, transaction)
    else:
        return process_transaction_form(request, transaction)


def transaction_delete_view(request, acc_pk, t_pk):
    """
    Delete a transaction object
    """
    account = get_object_or_404(BankAccount, pk=acc_pk)
    check_user_permissions(request.user, account)

    transaction = get_object_or_404(Transaction, pk=t_pk)
    transaction.delete()
    return redirect("transactions", pk=acc_pk)


def reassign_categories(request, pk):
    account = get_object_or_404(BankAccount, pk=pk)
    check_user_permissions(request.user, account)

    update_transaction_categories_for_account(account)

    messages.add_message(
        request, level=messages.SUCCESS, message="Kategorien erfolgreich aktualisiert."
    )

    return redirect("transactions", pk=pk)


#################################
# Depot views
#################################
def depot_overview(request, pk):
    """
    Overview of all transactions for a bank account
    """
    depot = get_object_or_404(BankDepot, pk=pk)
    check_user_permissions(request.user, depot)

    assets = depot.get_assets()

    transactions = {}
    for asset in assets:
        transactions[asset] = asset.get_transactions()

    context = {"depot": depot, "transactions": transactions}
    return render(request, "accounting/bank_depot_detail.html", context)


def display_asset_form(request, asset=None):
    asset_form = AssetForm(instance=asset)
    return render(
        request,
        "accounting/asset_form.html",
        {
            "form": asset_form,
            "asset": asset,
        },
    )


def process_asset_form(request, asset=None):
    asset_form = AssetForm(request.POST, instance=asset)
    if not asset_form.is_valid():
        return render(
            request,
            "accounting/asset_form.html",
            {
                "form": asset_form,
            },
        )

    asset_obj = asset_form.save()

    return redirect(
        "depot-detail",
        pk=asset_obj.bank_depot.pk,
    )


def depot_asset_update_view(request, dep_pk, as_pk):
    """
    Update a transaction object
    """
    depot = get_object_or_404(BankDepot, pk=dep_pk)
    check_user_permissions(request.user, depot)
    asset = get_object_or_404(DepotAsset, pk=as_pk)

    if request.method == "GET":
        return display_asset_form(request, asset)
    else:
        return process_asset_form(request, asset)


#################################
# Category views
#################################


def categories_view(request):
    """
    Overview of all categories
    """
    categories = Category.objects.all()
    context = {"categories": categories}
    return render(request, "accounting/categories.html", context)


class CategoryCreateView(CreatePopupMixin, LoginRequiredMixin, CreateView):
    """
    For category creation inside transaction creation (using a popup)
    """

    model = Category
    fields = ["name"]


def display_category_form(request, category=None):
    form = CategoryForm(instance=category)
    return render(request, "accounting/category_form.html", {"form": form})


def process_category_form(request, category=None):
    form = CategoryForm(request.POST, instance=category)
    if not form.is_valid():
        return render(request, "accounting/category_form.html", {"form": form})
    form.save()
    return redirect("categories")


def update_category(request, pk):
    category = get_object_or_404(Category, pk=pk)

    if request.method == "GET":
        return display_category_form(request, category=category)
    else:
        return process_category_form(request, category=category)


def create_category(request):
    if request.method == "GET":
        return display_category_form(request)
    else:
        return process_category_form(request)


# Plot views
def charts_view(request):
    return render(request, "accounting/plots.html", context={})


##########################
# Contract views
##########################
def contracts_view(request):
    contracts = get_contracts_for_user(request.user)
    active_contracts = contracts.filter(is_active=True)
    inactive_contracts = contracts.filter(is_active=False)
    return render(
        request,
        "accounting/contracts.html",
        context={
            "active_contracts": active_contracts,
            "inactive_contracts": inactive_contracts,
        },
    )


def display_contract_form(request, contract=None):
    form = ContractForm(
        instance=contract, user=request.user, initial={"owner": request.user.pk}
    )
    return render(request, "accounting/contract_form.html", {"form": form})


def process_contract_form(request, contract=None):
    form = ContractForm(
        request.POST,
        instance=contract,
        user=request.user,
        initial={"owner": request.user.pk},
    )
    if not form.is_valid():
        return render(request, "accounting/contract_form.html", {"form": form})
    contract_obj = form.save()
    return redirect("contract-detail", pk=contract_obj.pk)


def update_contract(request, pk):
    contract = get_object_or_404(Contract, pk=pk)

    if request.method == "GET":
        return display_contract_form(request, contract=contract)
    else:
        return process_contract_form(request, contract=contract)


def create_contract(request):
    if request.method == "GET":
        return display_contract_form(request)
    else:
        return process_contract_form(request)


def contract_detail_view(request, pk):
    contract = get_object_or_404(Contract, pk=pk)
    check_user_permissions(request.user, contract)

    transactions = contract.get_transactions()

    if transactions:
        first_transaction = transactions[len(transactions) - 1]
        last_transaction = transactions[0]
    else:
        first_transaction = None
        last_transaction = None

    return render(
        request,
        "accounting/contract_detail.html",
        {
            "contract": contract,
            "transactions": transactions,
            "first_transaction": first_transaction,
            "last_transaction": last_transaction,
        },
    )


def add_files_to_contract(request, pk):
    contract = get_object_or_404(Contract, pk=pk)
    check_user_permissions(request.user, contract)

    if request.method == "GET":
        formset = ContractFileFormSet(instance=contract)
        return render(
            request,
            "accounting/contract_files_form.html",
            {"formset": formset, "contract": contract},
        )
    else:
        formset = ContractFileFormSet(request.POST, request.FILES, instance=contract)
        if not formset.is_valid():
            return render(
                request,
                "accounting/contract_files_form.html",
                {"formset": formset, "contract": contract},
            )
        formset.save()
        return redirect("contract-detail", pk=pk)
