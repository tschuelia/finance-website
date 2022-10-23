from django import forms
from django.urls import reverse_lazy
from django_addanother.widgets import AddAnotherWidgetWrapper


from .models import Transaction, Category


class DateInput(forms.DateInput):
    input_type = 'date'


class TransactionForm(forms.ModelForm):
    class Meta:
        model = Transaction
        fields = "__all__"
        widgets = {
            "categories": AddAnotherWidgetWrapper(
                forms.SelectMultiple(
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


class CategoryForm(forms.ModelForm):
    class Meta:
        model = Category
        fields = "__all__"