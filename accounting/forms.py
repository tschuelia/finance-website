from django import forms
from django.contrib.auth.models import User
from django.shortcuts import get_object_or_404
from django.urls import reverse_lazy
from django_addanother.widgets import AddAnotherWidgetWrapper


from .models import Contract, DepotAsset, Transaction, Category


class DateInput(forms.DateInput):
    input_type = 'date'


class TransactionForm(forms.ModelForm):
    def __init__(self, *args, **kwargs):
        user = kwargs.pop("user")
        super(TransactionForm, self).__init__(*args, **kwargs)

        if user.is_superuser:
            self.fields["contract"] = forms.ModelChoiceField(queryset=Contract.objects.all())
        else:
            self.fields["contract"] = forms.ModelChoiceField(queryset=Contract.objects.filter(pk=user.pk))

    class Meta:
        model = Transaction
        fields = "__all__"
        widgets = {
            "category": AddAnotherWidgetWrapper(
                forms.Select(
                    attrs={
                        "class": "selectpicker",
                        "data-live-search": "true",
                        "data-size": "5",
                        "title": "Wähle Kategorien",
                        "data-actions-box": "true",
                    }
                ),
                reverse_lazy("create-category-popup"),
            ),
            "date_issue": DateInput(),
            "date_booking": DateInput()
        }


class TransactionFormTableRow(forms.ModelForm):
    recipient = forms.CharField(label="", required=False,)
    amount = forms.DecimalField(decimal_places=2, label="")
    subject = forms.CharField(label="", required=False)
    date_issue = forms.DateField(label="")
    date_booking = forms.DateField(label="")
    full_subject_string = forms.CharField(label="")
    category = forms.ModelChoiceField(
        label="",
        widget=forms.Select(
                attrs={
                    "class": "selectpicker",
                    "data-live-search": "true",
                    "data-size": "5",
                    "title": "",
                    "data-actions-box": "true",
                }
            ),
        required=False,
        queryset=Category.objects.all()
    )
    contract = forms.ModelChoiceField(
            label="",
            widget=forms.Select(
                attrs={
                    "class": "selectpicker",
                    "data-live-search": "true",
                    "data-size": "5",
                    "title": "",
                    "data-actions-box": "true",
                }
            ),
            required=False,
            queryset=Contract.objects.all()
        )

    def __init__(self, *args, **kwargs):
        user = kwargs.pop("user")
        super(TransactionFormTableRow, self).__init__(*args, **kwargs)

        if not user.is_superuser:
            self.fields["contract"]["queryset"] = Contract.objects.filter(pk=user.pk)



    class Meta:
        model = Transaction
        exclude = ["bank_account"]


class AssetForm(forms.ModelForm):
    class Meta:
        model = DepotAsset
        fields = ["current_balance", "last_update"]
        widgets = {
            "last_update": DateInput(),
        }


class CategoryForm(forms.ModelForm):
    class Meta:
        model = Category
        fields = "__all__"


class ContractForm(forms.ModelForm):
    def __init__(self, *args, **kwargs):
        user = kwargs.pop("user")
        super(ContractForm, self).__init__(*args, **kwargs)

        if user.is_superuser:
            self.fields["owner"] = forms.ModelChoiceField(queryset=User.objects.all())
        else:
            self.fields["owner"] = forms.ModelChoiceField(queryset=User.objects.filter(pk=user.pk))

    class Meta:
        model = Contract
        fields = "__all__"


class UploadFileForm(forms.Form):
    file = forms.FileField()


TransactionFormSet = forms.formset_factory(
    form=TransactionFormTableRow,
    can_delete=True,
    extra=1,
)


class FilterTransactionsForm(forms.Form):
    date_start = forms.DateField(label="", required=False, widget=DateInput())
    date_end = forms.DateField(label="", required=False, widget=DateInput())
    amount_min = forms.DecimalField(label="", required=False)
    amount_max = forms.DecimalField(label="", required=False)
    categories = forms.ModelMultipleChoiceField(
        label="",
        widget=forms.SelectMultiple(
                attrs={
                    "class": "selectpicker",
                    "data-live-search": "true",
                    "data-size": "5",
                    "title": "",
                    "data-actions-box": "true",
                }
            ),
        required=False,
        queryset=Category.objects.all()
    )


def process_transactions_formset(transactions_formset, bank_account):
    n_added_transactions = 0

    for form in transactions_formset:
        data = form.cleaned_data

        if not data:
            continue

        recipient = data["recipient"]

        if not recipient:
            recipient = "unbekannt"

        t = Transaction(
            bank_account=bank_account,
            category=data["category"],
            recipient=recipient,
            amount=data["amount"],
            subject=data["subject"],
            date_issue=data["date_issue"],
            date_booking=data["date_booking"],
            full_subject_string=data["full_subject_string"],
        )
        t.save()
        n_added_transactions += 1

    return n_added_transactions


