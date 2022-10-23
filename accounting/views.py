from django.shortcuts import render, get_object_or_404, redirect, reverse
from django.views.generic import CreateView
from django_addanother.views import CreatePopupMixin


from .models import BankAccount, Transaction, Category
from .forms import TransactionForm, CategoryForm


def transactions_view(request, pk):
    account = get_object_or_404(BankAccount, pk=pk)
    transactions = account.get_entries()
    context = {
        "account": account,
        "transactions": transactions,
    }
    return render(request, "accounting/transactions.html", context)


def transaction_detail_view(request, acc_pk, t_pk):
    account = get_object_or_404(BankAccount, pk=acc_pk)
    transaction = get_object_or_404(Transaction, pk=t_pk)

    context = {
        "account": account,
        "transaction": transaction,
    }
    return render(request, "accounting/transaction_detail.html", context)


def accounts_view(request):
    accounts = BankAccount.objects.all()
    context = {"accounts": accounts}
    return render(request, "accounting/bank_accounts.html", context)


def display_transaction_form(request, transaction=None):
    transaction_form = TransactionForm(instance=transaction)
    return render(
        request,
        "accounting/transaction_form.html",
        {
            "form": transaction_form,
        },
    )


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

    return redirect("transaction-detail", acc_pk=transaction_obj.bank_account.pk, t_pk=transaction_obj.pk)


def transaction_update_view(request, acc_pk, t_pk):
    transaction = get_object_or_404(Transaction, pk=t_pk)
    if request.method == "GET":
        return display_transaction_form(request, transaction)
    else:
        return process_transaction_form(request, transaction)


class CategoryCreateView(CreatePopupMixin, CreateView):
    """
    For category creation inside transaction creation
    """
    model = Category
    fields = ["name"]


def create_category(request):
    if request.method == "GET":
        form = CategoryForm()
        return render(request, "accounting/category_form.html", {"form": form})
    else:
        form = CategoryForm(request.POST)
        if not form.is_valid():
            return render(request, "accounting/category_form.html", {"form": form})
        form.save()
        return redirect("accounts")
