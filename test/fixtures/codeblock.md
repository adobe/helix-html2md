### Get the Needed Azure Account Details

+--------------------------------------------------------------------------------------------------------------------------------------------------+
| Procedure                                                                                                                                        |
+==================================================================================================================================================+
| 1. Log in to Azure with the Azure CLI.                                                                                                           |
|                                                                                                                                                  |
| 2. Query Azure for your tenant and subscription IDs. .                                                                                           |
|                                                                                                                                                  |
|    ```                                                                                                                                           |
|    az account list                                                                                                                               |
|    ```                                                                                                                                           |
|                                                                                                                                                  |
| 3. Copy the output which is similar to the following example. In the output, identify the `tenantId` tenant ID and the `id` of the subscription. |
|                                                                                                                                                  |
|    ```bash                                                                                                                                       |
|        "cloudName": "AzureCloud",                                                                                                                |
|         "homeTenantId": <This value is not needed>,                                                                                              |
|         "id": <This is the subscription ID>,                                                                                                     |
|         "isDefault": true,                                                                                                                       |
|         "managedByTenants": [],                                                                                                                  |
|                 "name": "Azure",                                                                                                                 |
|         "state": "Enabled",                                                                                                                      |
|         "tenantId": <This is the tenant ID>,                                                                                                     |
|         "user": {                                                                                                                                |
|           "name": "jdoe@example.onmicrosoft.com",                                                                                                |
|           "type": "user"                                                                                                                         |
|               }                                                                                                                                  |
|    ```                                                                                                                                           |
+--------------------------------------------------------------------------------------------------------------------------------------------------+
