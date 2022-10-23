from django.db import models


class Category(models.Model):
    name = models.CharField(max_length=255, verbose_name="Titel")

    def __str__(self):
        return self.name


class BankAccount(models.Model):
    name = models.CharField(max_length=255, verbose_name="Name des Accounts")
    bank = models.CharField(max_length=255, verbose_name="Name der Bank")
    owner = models.CharField(max_length=255, verbose_name="Name des Besitzers")
    current_amount = models.FloatField(default=0.0, verbose_name="Startkontostand")

    def __str__(self):
        return f"{self.name} ({self.bank})"

    def get_entries(self):
        return self.belongs_to.all()

    def get_balance(self):
        entries = self.get_entries()
        all_transactions = [e.amount for e in entries]
        return self.current_amount + sum(all_transactions)


class Transaction(models.Model):
    bank_account = models.ForeignKey(BankAccount, on_delete=models.SET_NULL, null=True, verbose_name="Bank", related_name="belongs_to")
    amount = models.FloatField(verbose_name="Betrag")
    recipient = models.CharField(max_length=255, verbose_name="Empfänger/Versender")
    categories = models.ManyToManyField(Category, blank=True, verbose_name="Kategorien")
    subject = models.CharField(max_length=255, verbose_name="Buchungsinformation")
    full_subject_string = models.TextField(verbose_name="gesamte Buchungsreferenz")
    date_issue = models.DateField(verbose_name="Buchungstag")
    date_booking = models.DateField(verbose_name="Wertstellungstag", blank=True, null=True)

    def __str__(self):
        if self.amount <= 0:
            event = "Ausgabe"
        else:
            event = "Einnahme"

        return f"{event}: {self.amount} ({self.recipient})"

    def get_categories(self):
        return self.categories.all().order_by("name")
