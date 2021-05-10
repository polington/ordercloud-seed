#!/usr/bin/env node
'use strict';

var yargs = require('yargs');
var axios = require('axios');
var qs = require('qs');
var ordercloudJavascriptSdk = require('ordercloud-javascript-sdk');
var fs = require('fs');
var yaml = require('js-yaml');
var chalk = require('chalk');
var emoji = require('node-emoji');
var pkg = require('lodash');
var jwt_decode = require('jwt-decode');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var yargs__default = /*#__PURE__*/_interopDefaultLegacy(yargs);
var axios__default = /*#__PURE__*/_interopDefaultLegacy(axios);
var qs__default = /*#__PURE__*/_interopDefaultLegacy(qs);
var fs__default = /*#__PURE__*/_interopDefaultLegacy(fs);
var yaml__default = /*#__PURE__*/_interopDefaultLegacy(yaml);
var chalk__default = /*#__PURE__*/_interopDefaultLegacy(chalk);
var emoji__default = /*#__PURE__*/_interopDefaultLegacy(emoji);
var pkg__default = /*#__PURE__*/_interopDefaultLegacy(pkg);
var jwt_decode__default = /*#__PURE__*/_interopDefaultLegacy(jwt_decode);

class Portal {
    static async login(username, password) {
        var response = await axios__default['default'].post(`${this.baseUrl}/oauth/token`, qs__default['default'].stringify({
            grant_type: "password",
            username: username,
            password: password
        }), {
            headers: {
                'content-type': 'application/x-www-form-urlencoded;charset=utf-8'
            }
        });
        return response.data.access_token;
    }
    static async getOrganizationToken(orgID, portalToken) {
        var response = await axios__default['default'].get(`${this.baseUrl}/organizations/${orgID}/token`, {
            headers: {
                'Authorization': `Bearer ${portalToken}`
            }
        });
        return response.data.access_token;
    }
    static async CreateOrganization(org, portalToken) {
        await axios__default['default'].put(`${this.baseUrl}/organizations/${org.Id}`, org, {
            headers: {
                'Authorization': `Bearer ${portalToken}`
            }
        });
    }
}
Portal.baseUrl = "https://portal.ordercloud.io/api/v1";

function log(message, messageType = MessageType.Progress) {
    if (messageType == MessageType.Success) {
        console.log(emoji__default['default'].get('heavy_check_mark'), chalk__default['default'].green(' SUCCESS -', message));
    }
    if (messageType == MessageType.Error) {
        console.log(emoji__default['default'].get('x'), chalk__default['default'].red('ERROR -', message));
    }
    if (messageType == MessageType.Progress) {
        console.log(emoji__default['default'].get('clock1'), 'PROGRESS -', message);
    }
}
var MessageType;
(function (MessageType) {
    MessageType[MessageType["Error"] = 0] = "Error";
    MessageType[MessageType["Progress"] = 1] = "Progress";
    MessageType[MessageType["Success"] = 2] = "Success";
})(MessageType || (MessageType = {}));

class SeedFile {
    constructor() {
        this.file = {
            Objects: {},
            Assignments: {}
        };
    }
    GetTypeField(resource) {
        return resource.isAssignment ? "Assignments" : "Objects";
    }
    AddRecords(resource, records) {
        var typeField = this.GetTypeField(resource);
        this.file[typeField][resource.name] = this.file[typeField][resource.name] || [];
        this.file[typeField][resource.name].push(...records);
    }
    GetRecords(resource) {
        var _a, _b;
        var typeField = this.GetTypeField(resource);
        return ((_b = (_a = this.file) === null || _a === void 0 ? void 0 : _a[typeField]) === null || _b === void 0 ? void 0 : _b[resource.name]) || [];
    }
    WriteToYaml(filePath) {
        fs__default['default'].writeFileSync(filePath, yaml__default['default'].dump(this.file));
    }
    ReadFromYaml(filePath, errors) {
        var file;
        try {
            file = fs__default['default'].readFileSync(filePath, 'utf8'); // consider switching to streams
            log(`found file: ${filePath}`);
        }
        catch (err) {
            errors.errors.push({ lineNumber: null, message: `No such file or directory ${filePath} found` });
            return false;
        }
        try {
            this.file = yaml__default['default'].load(file);
            log(`valid yaml: ${filePath}`);
        }
        catch (e) {
            console.log();
            var ex = e;
            errors.errors.push({ lineNumber: ex.mark.line, message: `YAML Exception in ${filePath}: ${ex.message}` });
            return false;
        }
        return true;
    }
}

const { chunk } = pkg__default['default'];
// Its not equivalent to the C# throttler. With some work it could be though.
async function RunThrottled(items, maxParallelism, asyncAction) {
    let results = [];
    const batches = chunk(items, maxParallelism);
    for (let batch of batches) {
        const batchResults = await Promise.all(batch.map(asyncAction));
        results = results.concat(batchResults);
    }
    return results;
}

const { flatten, range } = pkg__default['default'];
class OrderCloudBulk {
    static async ListAll(resource, ...routeParams) {
        const listFunc = resource.sdkObject[resource.listMethodName];
        const page1 = await listFunc(...routeParams, { page: 1, pageSize: 100 });
        const additionalPages = range(2, Math.max((page1 === null || page1 === void 0 ? void 0 : page1.Meta.TotalPages) + 1, 2));
        var results = await RunThrottled(additionalPages, 8, page => listFunc(...routeParams, { page, pageSize: 100 }));
        // combine and flatten items
        return flatten([page1, ...results].map((r) => r.Items));
    }
    static async CreateAll(resource, records, ...routeParams) {
        const createFunc = resource.sdkObject[resource.createMethodName];
        await RunThrottled(records, 8, record => createFunc(...routeParams, record));
    }
}

// strings coorespond to the name of the YAML property for that resource
var OCResourceEnum;
(function (OCResourceEnum) {
    OCResourceEnum["SecurityProfiles"] = "SecurityProfiles";
    OCResourceEnum["ImpersonationConfigs"] = "ImpersonationConfigs";
    OCResourceEnum["OpenIdConnects"] = "OpenIdConnects";
    OCResourceEnum["AdminUsers"] = "AdminUsers";
    OCResourceEnum["AdminUserGroups"] = "AdminUserGroups";
    OCResourceEnum["AdminAddresses"] = "AdminAddresses";
    OCResourceEnum["MessageSenders"] = "MessageSenders";
    OCResourceEnum["ApiClients"] = "ApiClients";
    OCResourceEnum["Incrementors"] = "Incrementors";
    OCResourceEnum["IntegrationEvents"] = "IntegrationEvents";
    OCResourceEnum["Webhooks"] = "Webhooks";
    OCResourceEnum["XpIndices"] = "XpIndices";
    OCResourceEnum["Buyers"] = "Buyers";
    OCResourceEnum["Users"] = "Users";
    OCResourceEnum["UserGroups"] = "UserGroups";
    OCResourceEnum["Addresses"] = "Addresses";
    OCResourceEnum["CostCenters"] = "CostCenters";
    OCResourceEnum["CreditCards"] = "CreditCards";
    OCResourceEnum["SpendingAccounts"] = "SpendingAccounts";
    OCResourceEnum["ApprovalRules"] = "ApprovalRules";
    OCResourceEnum["Suppliers"] = "Suppliers";
    OCResourceEnum["SupplierUsers"] = "SupplierUsers";
    OCResourceEnum["SupplierUserGroups"] = "SupplierUserGroups";
    OCResourceEnum["SupplierAddresses"] = "SupplierAddresses";
    OCResourceEnum["Catalogs"] = "Catalogs";
    OCResourceEnum["Categories"] = "Categories";
    OCResourceEnum["Products"] = "Products";
    OCResourceEnum["PriceSchedules"] = "PriceSchedules";
    OCResourceEnum["Specs"] = "Specs";
    OCResourceEnum["SpecOptions"] = "SpecOptions";
    OCResourceEnum["ProductFacets"] = "ProductFacets";
    OCResourceEnum["Promotions"] = "Promotions";
    OCResourceEnum["SecurityProfileAssignments"] = "SecurityProfileAssignments";
    OCResourceEnum["AdminUserGroupAssignments"] = "AdminUserGroupAssignments";
    OCResourceEnum["ApiClientAssignments"] = "ApiClientAssignments";
    OCResourceEnum["UserGroupAssignments"] = "UserGroupAssignments";
    OCResourceEnum["AddressAssignments"] = "AddressAssignments";
    OCResourceEnum["CostCenterAssignments"] = "CostCenterAssignments";
    OCResourceEnum["CreditCardAssignments"] = "CreditCardAssignments";
    OCResourceEnum["SpendingAccountAssignments"] = "SpendingAccountAssignments";
    OCResourceEnum["SupplierUserGroupsAssignments"] = "SupplierUserGroupsAssignments";
    OCResourceEnum["ProductAssignments"] = "ProductAssignments";
    OCResourceEnum["CatalogAssignments"] = "CatalogAssignments";
    OCResourceEnum["ProductCatalogAssignment"] = "ProductCatalogAssignment";
    OCResourceEnum["CategoryAssignments"] = "CategoryAssignments";
    OCResourceEnum["CategoryProductAssignments"] = "CategoryProductAssignments";
    OCResourceEnum["SpecProductAssignments"] = "SpecProductAssignments";
    OCResourceEnum["PromotionAssignment"] = "PromotionAssignment";
})(OCResourceEnum || (OCResourceEnum = {}));

const Directory = [
    {
        name: OCResourceEnum.SecurityProfiles,
        modelName: 'SecurityProfile',
        sdkObject: ordercloudJavascriptSdk.SecurityProfiles,
        createPriority: 2,
    },
    {
        name: OCResourceEnum.ImpersonationConfigs,
        modelName: 'ImpersonationConfig',
        sdkObject: ordercloudJavascriptSdk.ImpersonationConfigs,
        createPriority: 6,
        foreignKeys: {
            ClientID: OCResourceEnum.ApiClients,
            SecurityProfileID: OCResourceEnum.SecurityProfiles,
            BuyerID: OCResourceEnum.Buyers,
            GroupID: OCResourceEnum.UserGroups,
            UserID: OCResourceEnum.Users,
            ImpersonationBuyerID: OCResourceEnum.Buyers,
            ImpersonationGroupID: (a, b) => false,
            ImpersonationUserID: (a, b) => false // todo. I think this could be an admin or buyer user
        }
    },
    {
        name: OCResourceEnum.OpenIdConnects,
        modelName: 'OpenIdConnect',
        sdkObject: ordercloudJavascriptSdk.OpenIdConnects,
        createPriority: 6,
        foreignKeys: {
            OrderCloudApiClientID: OCResourceEnum.ApiClients,
            IntegrationEventID: OCResourceEnum.IntegrationEvents
        }
    },
    {
        name: OCResourceEnum.AdminUsers,
        modelName: 'User',
        sdkObject: ordercloudJavascriptSdk.AdminUsers,
        createPriority: 2
    },
    {
        name: OCResourceEnum.AdminUserGroups,
        modelName: 'UserGroup',
        sdkObject: ordercloudJavascriptSdk.AdminUserGroups,
        createPriority: 2
    },
    {
        name: OCResourceEnum.AdminAddresses,
        modelName: 'Address',
        sdkObject: ordercloudJavascriptSdk.AdminAddresses,
        createPriority: 2
    },
    {
        name: OCResourceEnum.MessageSenders,
        modelName: 'MessageSender',
        sdkObject: ordercloudJavascriptSdk.MessageSenders,
        createPriority: 2
    },
    {
        name: OCResourceEnum.ApiClients,
        modelName: 'ApiClient',
        sdkObject: ordercloudJavascriptSdk.ApiClients,
        createPriority: 5,
        foreignKeys: {
            IntegrationEventID: OCResourceEnum.IntegrationEvents,
            DefaultContextUserName: (a, b) => false, // todo. Look for usernames 
        },
    },
    {
        name: OCResourceEnum.Incrementors,
        modelName: 'Incrementor',
        sdkObject: ordercloudJavascriptSdk.Incrementors,
        createPriority: 1
    },
    {
        name: OCResourceEnum.Webhooks,
        modelName: 'Webhook',
        sdkObject: ordercloudJavascriptSdk.Webhooks,
        createPriority: 6,
        foreignKeys: {
            ApiClientIDs: (a, b) => false, // todo. validate list
        }
    },
    {
        name: OCResourceEnum.IntegrationEvents,
        modelName: 'IntegrationEvent',
        sdkObject: ordercloudJavascriptSdk.IntegrationEvents,
        createPriority: 2
    },
    {
        name: OCResourceEnum.XpIndices,
        modelName: "XpIndex",
        sdkObject: ordercloudJavascriptSdk.XpIndices,
        createPriority: 1
    },
    {
        name: OCResourceEnum.Buyers,
        modelName: "Buyer",
        sdkObject: ordercloudJavascriptSdk.Buyers,
        createPriority: 3,
        foreignKeys: {
            DefaultCatalogID: OCResourceEnum.Catalogs
        },
        children: [OCResourceEnum.Users, OCResourceEnum.UserGroups, OCResourceEnum.Addresses, OCResourceEnum.CostCenters, OCResourceEnum.CreditCards, OCResourceEnum.SpendingAccounts, OCResourceEnum.ApprovalRules, OCResourceEnum.UserGroupAssignments, OCResourceEnum.SpendingAccountAssignments, OCResourceEnum.AddressAssignments, OCResourceEnum.CostCenterAssignments, OCResourceEnum.CreditCardAssignments, OCResourceEnum.SpendingAccountAssignments],
    },
    {
        name: OCResourceEnum.Users,
        modelName: "User",
        sdkObject: ordercloudJavascriptSdk.Users,
        createPriority: 4,
        parentRefFieldName: "BuyerID",
        isChild: true,
    },
    {
        name: OCResourceEnum.UserGroups,
        modelName: "UserGroup",
        sdkObject: ordercloudJavascriptSdk.UserGroups,
        createPriority: 4,
        parentRefFieldName: "BuyerID",
        isChild: true,
    },
    {
        name: OCResourceEnum.Addresses,
        modelName: "Address",
        sdkObject: ordercloudJavascriptSdk.Addresses,
        createPriority: 4,
        parentRefFieldName: "BuyerID",
        isChild: true,
    },
    {
        name: OCResourceEnum.CostCenters,
        modelName: "CostCenter",
        sdkObject: ordercloudJavascriptSdk.CostCenters,
        createPriority: 4,
        parentRefFieldName: "BuyerID",
        isChild: true,
    },
    {
        name: OCResourceEnum.CreditCards,
        modelName: "CreditCard",
        sdkObject: ordercloudJavascriptSdk.CreditCards,
        createPriority: 4,
        parentRefFieldName: "BuyerID",
        isChild: true,
    },
    {
        name: OCResourceEnum.SpendingAccounts,
        modelName: "SpendingAccount",
        sdkObject: ordercloudJavascriptSdk.SpendingAccounts,
        createPriority: 4,
        parentRefFieldName: "BuyerID",
        isChild: true,
    },
    {
        name: OCResourceEnum.ApprovalRules,
        modelName: "ApprovalRule",
        sdkObject: ordercloudJavascriptSdk.ApprovalRules,
        createPriority: 5,
        parentRefFieldName: "BuyerID",
        isChild: true,
        foreignKeys: {
            ApprovingGroupID: (a, b) => false // todo - can this be a buyer or admin group?
        }
    },
    {
        name: OCResourceEnum.Catalogs,
        modelName: "Catalog",
        sdkObject: ordercloudJavascriptSdk.Catalogs,
        createPriority: 2,
        children: [OCResourceEnum.Categories, OCResourceEnum.CategoryAssignments, OCResourceEnum.CategoryProductAssignments]
    },
    {
        name: OCResourceEnum.Categories,
        modelName: "Category",
        sdkObject: ordercloudJavascriptSdk.Categories,
        createPriority: 3,
        parentRefFieldName: "CatalogID",
        isChild: true,
        foreignKeys: {
            ParentID: OCResourceEnum.Categories
        }
    },
    {
        name: OCResourceEnum.Suppliers,
        modelName: "Supplier",
        sdkObject: ordercloudJavascriptSdk.Suppliers,
        createPriority: 2,
        children: [OCResourceEnum.SupplierUsers, OCResourceEnum.SupplierUserGroups, OCResourceEnum.SupplierAddresses, OCResourceEnum.SupplierUserGroupsAssignments]
    },
    {
        name: OCResourceEnum.SupplierUsers,
        modelName: "User",
        sdkObject: ordercloudJavascriptSdk.SupplierUsers,
        createPriority: 3,
        parentRefFieldName: "SupplierID",
        isChild: true,
    },
    {
        name: OCResourceEnum.SupplierUserGroups,
        modelName: "UserGroup",
        sdkObject: ordercloudJavascriptSdk.SupplierUserGroups,
        createPriority: 3,
        parentRefFieldName: "SupplierID",
        isChild: true,
    },
    {
        name: OCResourceEnum.SupplierAddresses,
        modelName: "Address",
        sdkObject: ordercloudJavascriptSdk.SupplierAddresses,
        createPriority: 3,
        parentRefFieldName: "SupplierID",
        isChild: true,
    },
    {
        name: OCResourceEnum.Products,
        modelName: "Product",
        sdkObject: ordercloudJavascriptSdk.Products,
        createPriority: 4,
        foreignKeys: {
            DefaultPriceScheduleID: OCResourceEnum.PriceSchedules,
            ShipFromAddressID: (a, b) => false,
            DefaultSupplierID: OCResourceEnum.Suppliers
        }
    },
    {
        name: OCResourceEnum.PriceSchedules,
        modelName: "PriceSchedule",
        sdkObject: ordercloudJavascriptSdk.PriceSchedules,
        createPriority: 2
    },
    {
        name: OCResourceEnum.Specs,
        modelName: "Spec",
        sdkObject: ordercloudJavascriptSdk.Specs,
        createPriority: 2,
        foreignKeys: {
            DefaultOptionID: OCResourceEnum.SpecOptions,
        },
        children: [OCResourceEnum.SpecOptions]
    },
    {
        name: OCResourceEnum.SpecOptions,
        modelName: "SpecOption",
        sdkObject: ordercloudJavascriptSdk.Specs,
        createPriority: 3,
        parentRefFieldName: "SpecID",
        listMethodName: "ListOptions",
        isChild: true
    },
    {
        name: OCResourceEnum.ProductFacets,
        modelName: "ProductFacet",
        sdkObject: ordercloudJavascriptSdk.ProductFacets,
        createPriority: 2
    },
    {
        name: OCResourceEnum.Promotions,
        modelName: "Promotion",
        sdkObject: ordercloudJavascriptSdk.Promotions,
        createPriority: 2
    },
    {
        name: OCResourceEnum.SecurityProfileAssignments,
        modelName: "SecurityProfileAssignment",
        sdkObject: ordercloudJavascriptSdk.SecurityProfiles,
        createPriority: 5,
        isAssignment: true,
        foreignKeys: {
            SecurityProfileID: OCResourceEnum.SecurityProfiles,
            BuyerID: OCResourceEnum.Buyers,
            SupplierID: OCResourceEnum.Suppliers,
            UserID: (a, b) => false,
            UserGroupID: (a, b) => false // todo. Could be any user group type
        },
    },
    {
        name: OCResourceEnum.AdminUserGroupAssignments,
        modelName: "UserGroupAssignment",
        sdkObject: ordercloudJavascriptSdk.AdminUserGroups,
        createPriority: 3,
        isAssignment: true,
        listMethodName: 'ListUserAssignments',
        foreignKeys: {
            UserID: OCResourceEnum.AdminUsers,
            UserGroupID: OCResourceEnum.AdminUserGroups,
        },
    },
    {
        name: OCResourceEnum.ApiClientAssignments,
        modelName: "ApiClientAssignment",
        sdkObject: ordercloudJavascriptSdk.ApiClients,
        createPriority: 6,
        isAssignment: true,
        foreignKeys: {
            ApiClientID: OCResourceEnum.ApiClients,
            BuyerID: OCResourceEnum.Buyers,
            SupplierID: OCResourceEnum.Suppliers,
        },
    },
    {
        name: OCResourceEnum.UserGroupAssignments,
        modelName: "UserGroupAssignment",
        sdkObject: ordercloudJavascriptSdk.UserGroups,
        createPriority: 5,
        isAssignment: true,
        parentRefFieldName: "BuyerID",
        isChild: true,
        listMethodName: 'ListUserAssignments',
        foreignKeys: {
            UserID: OCResourceEnum.Users,
            UserGroupID: OCResourceEnum.UserGroups,
        },
    },
    {
        name: OCResourceEnum.AddressAssignments,
        modelName: "AddressAssignment",
        sdkObject: ordercloudJavascriptSdk.Addresses,
        createPriority: 5,
        isAssignment: true,
        parentRefFieldName: "BuyerID",
        isChild: true,
        foreignKeys: {
            AddressID: OCResourceEnum.Addresses,
            UserID: OCResourceEnum.Users,
            UserGroupID: OCResourceEnum.UserGroups,
        },
    },
    {
        name: OCResourceEnum.CostCenterAssignments,
        modelName: "CostCenterAssignment",
        sdkObject: ordercloudJavascriptSdk.CostCenters,
        createPriority: 5,
        isAssignment: true,
        parentRefFieldName: "BuyerID",
        isChild: true,
        foreignKeys: {
            CostCenterID: OCResourceEnum.CostCenters,
            UserGroupID: OCResourceEnum.UserGroups,
        },
    },
    {
        name: OCResourceEnum.CreditCardAssignments,
        modelName: "CreditCardAssignment",
        sdkObject: ordercloudJavascriptSdk.CreditCards,
        createPriority: 5,
        isAssignment: true,
        parentRefFieldName: "BuyerID",
        isChild: true,
        foreignKeys: {
            CreditCardID: OCResourceEnum.Addresses,
            UserID: OCResourceEnum.Users,
            UserGroupID: OCResourceEnum.UserGroups,
        },
    },
    {
        name: OCResourceEnum.SpendingAccountAssignments,
        modelName: "SpendingAccountAssignment",
        sdkObject: ordercloudJavascriptSdk.SpendingAccounts,
        createPriority: 5,
        isAssignment: true,
        parentRefFieldName: "BuyerID",
        isChild: true,
        foreignKeys: {
            SpendingAccountID: OCResourceEnum.SpendingAccounts,
            UserID: OCResourceEnum.Users,
            UserGroupID: OCResourceEnum.UserGroups,
        },
    },
    {
        name: OCResourceEnum.SupplierUserGroupsAssignments,
        modelName: "UserGroupAssignment",
        sdkObject: ordercloudJavascriptSdk.SupplierUserGroups,
        createPriority: 4,
        isAssignment: true,
        parentRefFieldName: "SupplierID",
        isChild: true,
        listMethodName: 'ListUserAssignments',
        foreignKeys: {
            UserID: OCResourceEnum.SupplierUsers,
            UserGroupID: OCResourceEnum.SupplierUserGroups,
        },
    },
    {
        name: OCResourceEnum.ProductAssignments,
        modelName: "ProductAssignment",
        sdkObject: ordercloudJavascriptSdk.Products,
        createPriority: 5,
        isAssignment: true,
        foreignKeys: {
            ProductID: OCResourceEnum.Products,
            BuyerID: OCResourceEnum.Buyers,
            UserGroupID: OCResourceEnum.SupplierUserGroups,
            PriceScheduleID: OCResourceEnum.PriceSchedules
        },
    },
    {
        name: OCResourceEnum.CatalogAssignments,
        modelName: "CatalogAssignment",
        sdkObject: ordercloudJavascriptSdk.Catalogs,
        createPriority: 4,
        isAssignment: true,
        foreignKeys: {
            CatalogID: OCResourceEnum.Catalogs,
            BuyerID: OCResourceEnum.Buyers
        },
    },
    {
        name: OCResourceEnum.ProductCatalogAssignment,
        modelName: "ProductCatalogAssignment",
        sdkObject: ordercloudJavascriptSdk.Catalogs,
        createPriority: 5,
        isAssignment: true,
        listMethodName: 'ListProductAssignments',
        foreignKeys: {
            CatalogID: OCResourceEnum.Catalogs,
            ProductID: OCResourceEnum.Products
        },
    },
    {
        name: OCResourceEnum.CategoryAssignments,
        modelName: "CategoryAssignment",
        sdkObject: ordercloudJavascriptSdk.Categories,
        createPriority: 5,
        isAssignment: true,
        parentRefFieldName: "CatalogID",
        isChild: true,
        foreignKeys: {
            CategoryID: OCResourceEnum.Categories,
            UserID: OCResourceEnum.Users,
            UserGroupID: OCResourceEnum.UserGroups,
        },
    },
    {
        name: OCResourceEnum.CategoryProductAssignments,
        modelName: "CategoryProductAssignment",
        sdkObject: ordercloudJavascriptSdk.Categories,
        createPriority: 5,
        isAssignment: true,
        parentRefFieldName: "CatalogID",
        isChild: true,
        listMethodName: 'ListProductAssignments',
        foreignKeys: {
            CategoryID: OCResourceEnum.Categories,
            ProductID: OCResourceEnum.Products,
        },
    },
    {
        name: OCResourceEnum.SpecProductAssignments,
        modelName: "SpecProductAssignment",
        sdkObject: ordercloudJavascriptSdk.Specs,
        createPriority: 5,
        isAssignment: true,
        listMethodName: 'ListProductAssignments',
        foreignKeys: {
            SpecID: OCResourceEnum.Specs,
            ProductID: OCResourceEnum.Products,
            DefaultOptionID: OCResourceEnum.SpecOptions,
        },
    },
    {
        name: OCResourceEnum.PromotionAssignment,
        modelName: "PromotionAssignment",
        sdkObject: ordercloudJavascriptSdk.Promotions,
        createPriority: 5,
        isAssignment: true,
        foreignKeys: {
            PromotionID: OCResourceEnum.PromotionAssignment,
            BuyerID: OCResourceEnum.Buyers,
            UserGroupID: OCResourceEnum.UserGroups,
        },
    },
];
function ApplyDefaults(resource) {
    resource.isAssignment = resource.isAssignment || false;
    resource.listMethodName = resource.listMethodName || (resource.isAssignment ? "ListAssignments" : "List");
    resource.createMethodName = resource.createMethodName || (resource.isAssignment ? "CreateAssignment" : "Create");
    resource.foreignKeys = resource.foreignKeys || {};
    resource.children = resource.children || [];
    resource.isChild = resource.isChild || false;
    return resource;
}
async function BuildResourceDirectory(includeOpenAPI = false) {
    var openAPISpec;
    if (includeOpenAPI) {
        openAPISpec = await axios__default['default'].get(`https://api.ordercloud.io/v1/openapi/v3`);
    }
    return Directory.map(resource => {
        var modified = ApplyDefaults(resource);
        if (includeOpenAPI) {
            modified.openAPIProperties = openAPISpec.data.components.schemas[resource.modelName].properties;
        }
        return modified;
    });
}

async function download(username, password, environment, orgID) {
    var missingInputs = [];
    var validEnvironments = ['staging', 'sandbox', 'prod'];
    var urls = {
        staging: "https://stagingapi.ordercloud.io",
        sandbox: "https://sandboxapi.ordercloud.io",
        prod: "https://api.ordercloud.io",
    };
    if (!environment)
        missingInputs.push("environment");
    if (!orgID)
        missingInputs.push("orgID");
    if (!username)
        missingInputs.push("username");
    if (!password)
        missingInputs.push("password");
    if (missingInputs.length > 0) {
        return log(`Missing required arguments: ${missingInputs.join(", ")}`, MessageType.Error);
    }
    if (!validEnvironments.includes(environment)) {
        return log(`environment must be one of ${validEnvironments.join(", ")}`, MessageType.Error);
    }
    var url = urls[environment];
    // Set up configuration
    ordercloudJavascriptSdk.Configuration.Set({ baseApiUrl: url });
    // Authenticate
    var portal_token;
    var org_token;
    try {
        portal_token = await Portal.login(username, password);
    }
    catch (_a) {
        return log(`Username \"${username}\" and Password \"${password}\" were not valid`, MessageType.Error);
    }
    try {
        org_token = await Portal.getOrganizationToken(orgID, portal_token);
    }
    catch (_b) {
        return log(`Organization with ID \"${orgID}\" not found`, MessageType.Error);
    }
    var decoded = jwt_decode__default['default'](org_token);
    if (decoded.aud !== url) {
        return log(`Organization \"${orgID}\" found, but is not in specified environment \"${environment}\"`, MessageType.Error);
    }
    ordercloudJavascriptSdk.Tokens.SetAccessToken(org_token);
    log("Found your organization. Beginning download.", MessageType.Success);
    // Pull Data from Ordercloud
    var file = new SeedFile();
    var directory = await BuildResourceDirectory(false);
    for (let resource of directory) {
        if (resource.isChild) {
            continue; // resource will be handled as part of its parent
        }
        var records = await OrderCloudBulk.ListAll(resource);
        file.AddRecords(resource, records);
        for (let childResourceName of resource.children) {
            let childResource = directory.find(x => x.name == childResourceName);
            for (let parentRecord of records) {
                var childRecords = await OrderCloudBulk.ListAll(childResource, parentRecord.ID); // assume ID exists. Which is does for all parent types.
                for (let childRecord of childRecords) {
                    childRecord[childResource.parentRefFieldName] = parentRecord.ID;
                }
                file.AddRecords(childResource, childRecords);
            }
            log("Finished " + childRecords.length + " " + childResourceName);
        }
        log("Finished " + records.length + " " + resource.name);
    }
    // Write to file
    file.WriteToYaml('ordercloud-seed.yml');
    log("Done! Wrote to file \"ordercloud-seed.yml\"", MessageType.Success);
}

yargs__default['default'].scriptName("ordercloud-seed")
    .usage('$0 <cmd> [args] -')
    .command('download', 'Download all org data into a file', (yargs) => {
    yargs.option('environment', {
        type: 'string',
        alias: 'e',
        describe: 'Environment'
    });
    yargs.option('orgID', {
        type: 'string',
        alias: 'o',
        describe: 'Organization ID'
    });
    yargs.option('username', {
        type: 'string',
        alias: 'u',
        describe: 'Portal username'
    });
    yargs.option('password', {
        type: 'string',
        alias: 'p',
        describe: 'Portal password'
    });
}, function (argv) {
    download(argv.u, argv.p, argv.e, argv.o);
})
    .help()
    .argv;