from django.contrib import admin

from .models import Category, BankAccount, Transaction
# Register your models here.
admin.site.register(Category)
admin.site.register(BankAccount)
admin.site.register(Transaction)
