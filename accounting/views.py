from django_addanother.views import CreatePopupMixin
from django.core.paginator import Paginator
from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib import messages
from django.shortcuts import render, get_object_or_404, redirect
from django.views.generic import CreateView

from .models import (
    BankAccount,
    Transaction,
    Category,
    check_user_permissions,
    get_bank_accounts_for_user,
    update_transaction_categories_for_account
)
from .forms import (
    TransactionForm,
    CategoryForm,
    UploadFileForm,
    TransactionFormSet,
    FilterTransactionsForm,
    process_transactions_formset,
)
from .csv_to_transactions import csv_to_transactions


TRANSACTIONS_PAGE_LIMIT = 100

#################################
# Overview of Bank Accounts
#################################

@login_required
def accounts_view(request):
    """
    Display all bank accounts the user is allowed to view
    """
    accounts = get_bank_accounts_for_user(request.user)
    context = {"accounts": accounts}
    return render(request, "accounting/bank_accounts.html", context)


#################################
# Bank Account specific views
#################################
@login_required
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
        categories=request.GET.get("categories"),
    )

    paginator = Paginator(transactions, TRANSACTIONS_PAGE_LIMIT)
    current_page = request.GET.get("page")
    page_obj = paginator.get_page(current_page)

    context = {"account": account, "transactions": transactions, "page_obj": page_obj, "form": filter_form}
    return render(request, "accounting/bank_account_detail.html", context)


#################################
# Transaction specific views
#################################
@login_required
def transactions_add_multiple(request, pk):
    """
    View that allows table based adding of multiple transactions to the bank account
    """
    account = get_object_or_404(BankAccount, pk=pk)
    check_user_permissions(request.user, account)

    if request.method == "POST":
        transactions_formset = TransactionFormSet(request.POST, request.FILES)
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
        transactions_formset = TransactionFormSet()
        return render(
            request,
            "accounting/transaction_formset.html",
            {"formset": transactions_formset, "account": account},
        )


@login_required
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
            transactions_formset = TransactionFormSet(initial=transactions)
            return render(
                request,
                "accounting/transaction_formset.html",
                {"formset": transactions_formset, "account": account},
            )
    else:
        form = UploadFileForm()
    return render(request, "accounting/transaction_upload_form.html", {"form": form})


@login_required
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


@login_required
def display_transaction_form(request, transaction=None):
    transaction_form = TransactionForm(instance=transaction)
    return render(
        request,
        "accounting/transaction_form.html",
        {
            "form": transaction_form,
        },
    )


@login_required
def process_transaction_form(request, transaction=None):
    transaction_form = TransactionForm(request.POST, instance=transaction)
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


@login_required
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


@login_required
def reassign_categories(request, pk):
    account = get_object_or_404(BankAccount, pk=pk)
    check_user_permissions(request.user, account)

    update_transaction_categories_for_account(account)

    messages.add_message(request, level=messages.SUCCESS, message="Kategorien erfolgreich aktualisiert.")

    return redirect("transactions", pk=pk)

#################################
# Category views
#################################


@login_required
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


@login_required
def display_category_form(request, category=None):
    form = CategoryForm(instance=category)
    return render(request, "accounting/category_form.html", {"form": form})


@login_required
def process_category_form(request, category=None):
    form = CategoryForm(request.POST, instance=category)
    if not form.is_valid():
        return render(request, "accounting/category_form.html", {"form": form})
    form.save()
    return redirect("categories")


@login_required
def update_category(request, pk):
    category = get_object_or_404(Category, pk=pk)

    if request.method == "GET":
        return display_category_form(request, category=category)
    else:
        return process_category_form(request, category=category)


@login_required
def create_category(request):
    if request.method == "GET":
        return display_category_form(request)
    else:
        return process_category_form(request)


# Plot views
@login_required
def charts_view(request):
    return render(request, "accounting/plots.html", context={})
