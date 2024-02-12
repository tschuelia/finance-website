from django.contrib import admin

from .models import Category, BankAccount, Transaction, BankDepot, DepotAsset, DepotAssetTransaction
# Register your models here.
admin.site.register(Category)
admin.site.register(BankAccount)
admin.site.register(Transaction)
admin.site.register(BankDepot)
admin.site.register(DepotAsset)
admin.site.register(DepotAssetTransaction)
