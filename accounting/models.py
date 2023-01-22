import datetime

from django.db import models
from django.db.models import Q, F, Func
from django.contrib.auth.models import User
from django.core.exceptions import PermissionDenied

from enum import Enum


class TransactionType(Enum):
    ALL = "Einnahmen & Ausgaben"
    INCOME = "Einnahmen"
    EXPENSE = "Ausgaben"


class Category(models.Model):
    name = models.CharField(max_length=255, verbose_name="Titel", unique=True)
    patterns = models.TextField(verbose_name="Patterns (new line separated)")

    def __str__(self):
        return self.name

    def print_patterns(self):
        return ", ".join(self.get_patterns())

    def get_patterns(self):
        return [p.strip() for p in self.patterns.split("\n")]


class BankAccount(models.Model):
    owner = models.ForeignKey(
        User, on_delete=models.CASCADE, verbose_name="Kontobesitzer"
    )
    name = models.CharField(max_length=255, verbose_name="Name des Accounts")
    bank = models.CharField(max_length=255, verbose_name="Name der Bank")
    current_amount = models.DecimalField(
        max_digits=10, decimal_places=2, default=0.0, verbose_name="Startkontostand"
    )

    def __str__(self):
        return f"{self.name} ({self.bank})"

    def get_oldest_transaction_date(self):
        transactions = self.belongs_to.all().order_by("date_issue")

        if len(transactions) > 0:
            return transactions[0].date_issue

        return datetime.date.today()

    def get_newest_transaction_date(self):
        transactions = self.belongs_to.all().order_by("-date_issue")

        if len(transactions) > 0:
            return transactions[0].date_issue

        return datetime.date.today()

    def get_max_transaction_amount(self):
        transactions = self.belongs_to.all()
        transactions = transactions.annotate(absolute_amount=Func(F("amount"), function="ABS"))
        transactions = transactions.order_by("absolute_amount")

        if len(transactions) > 0:
            return transactions.last().amount

        return 0.0

    def get_transactions(
        self,
        search_term=None,
        date_start=None,
        date_end=None,
        amount_min=None,
        amount_max=None,
        categories=None,
        transaction_type=TransactionType.ALL
    ):
        transactions = self.belongs_to.all()

        # filter by search term (recipient and subject)
        if search_term is not None:
            transactions = transactions.filter(
                Q(recipient__contains=search_term) | Q(subject__contains=search_term)
            )

        # filter by date
        # if no start date passed: start with the oldest transaction
        # if no end date passed: end with today
        if not date_start:
            date_start = self.get_oldest_transaction_date()

        if not date_end:
            date_end = datetime.date.today()

        transactions = transactions.filter(date_issue__range=(date_start, date_end))

        # filter by absolute transaction amount
        # if no minimum: start with 0.0
        # if no maximum: end with the largest transaction amount

        if not amount_min:
            amount_min = 0.0

        if not amount_max:
            amount_max = abs(self.get_max_transaction_amount())

        transactions = transactions.annotate(absolute_amount=Func(F("amount"), function="ABS"))
        transactions = transactions.filter(absolute_amount__range=(amount_min, amount_max))

        # filter by categories if categories are set
        if categories:
            transactions = transactions.filter(category__in=categories)

        transactions = transactions.order_by("date_issue", "date_booking", "recipient").reverse()

        # filter by transaction type
        if transaction_type == TransactionType.ALL:
            return transactions
        elif transaction_type == TransactionType.INCOME:
            return transactions.filter(amount__gte=0.0)
        elif transaction_type == TransactionType.EXPENSE:
            return transactions.filter(amount__lt=0.0)
        else:
            raise ValueError(f"Unrecognized transaction_type: {transaction_type}.")

    def get_balance(self):
        transactions = self.belongs_to.all()
        all_transactions = [t.amount for t in transactions]
        return self.current_amount + sum(all_transactions)


class Transaction(models.Model):
    bank_account = models.ForeignKey(
        BankAccount,
        on_delete=models.SET_NULL,
        null=True,
        verbose_name="Bank",
        related_name="belongs_to",
    )
    recipient = models.CharField(max_length=255, verbose_name="Empfänger/Versender")
    amount = models.DecimalField(decimal_places=2, max_digits=10, verbose_name="Betrag")
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, blank=True, null=True, verbose_name="Kategorie")
    subject = models.CharField(max_length=255, verbose_name="Buchungsinformation")
    date_issue = models.DateField(verbose_name="Buchungstag")
    date_booking = models.DateField(
        verbose_name="Wertstellungstag", blank=True, null=True
    )
    full_subject_string = models.TextField(verbose_name="gesamte Buchungsreferenz")

    def __str__(self):
        if self.amount <= 0:
            event = "Ausgabe"
        else:
            event = "Einnahme"

        return f"{event}: {self.amount} ({self.recipient})"


def check_user_permissions(user, bank_account):
    # only superusers or the owner of the bank_account are allowed to view and modified anything related
    # to the given bank account
    if user.is_superuser:
        return
    if user == bank_account.owner:
        return
    else:
        raise PermissionDenied()


def get_bank_accounts_for_user(user):
    if user.is_superuser:
        return BankAccount.objects.all()
    else:
        return BankAccount.filter(owner=user)


def check_any_pattern_in_string(string, patterns):
    for p in patterns:
        if p in string:
            return True

    return False


def get_category_for_pattern(pattern):
    for cat in Category.objects.all():
        if check_any_pattern_in_string(pattern, cat.get_patterns()):
            return cat


def transaction_exists(transaction_data, bank_account):
    account_transactions = Transaction.objects.filter(bank_account=bank_account)

    print(transaction_data.keys())

    for transaction in account_transactions:
        if transaction.amount != transaction_data["amount"]:
            continue
        if transaction.date_issue != transaction_data["date_issue"]:
            continue
        if transaction.date_booking != transaction_data["date_booking"]:
            continue
        if transaction.full_subject_string != transaction_data["full_subject_string"]:
            continue

        # if all of the above attributes are identical I consider the transaction_data tp be
        # a duplicate -> return True (transaction already exists)
        return True

    return False


def get_category(recipient, subject):
    if recipient is None:
        recipient = ""
    if subject is None:
        subject = ""

    category = get_category_for_pattern(recipient)

    if category is None:
        category = get_category_for_pattern(subject)

    return category


def update_transaction_categories_for_account(account):
    for transaction in account.get_transactions():
        transaction.category = get_category(transaction.recipient, transaction.subject)
        transaction.save()

