import { defineBackend } from "@aws-amplify/backend";
import { auth } from "./auth/resource";
import { data } from "./data/resource";
import { storage } from "./storage/resource";
import { helloKla } from "./functions/hello-kla/resource";
import { listReservedHours } from "./functions/list-reserved-hours/resource";
import { createReservation } from "./functions/create-reservation/resource";
import { notifyDeviceLoanRequest } from "./functions/notify-device-loan-request/resource";
import { createLoanAndNotify } from "./functions/create-loan-and-notify/resource";
import { adminUpsertRoleAssignment } from "./functions/admin-upsert-role-assignment/resource";
import { adminImportUserAccounts } from "./functions/admin-import-user-accounts/resource";
import { adminBulkUpdateUserRoles } from "./functions/admin-bulk-update-user-roles/resource";
import { adminDeleteUserRoleAssignments } from "./functions/admin-delete-user-role-assignments/resource";
import { adminSyncCognitoUsers } from "./functions/admin-sync-cognito-users/resource";
import { syncUserRolesPreToken } from "./functions/sync-user-roles-pre-token/resource";
import { adminStartStudentProfileImport } from "./functions/admin-start-student-profile-import/resource";
import { studentProfileImportWorker } from "./functions/student-profile-import-worker/resource";
import { adminStartUserRoleImport } from "./functions/admin-start-user-role-import/resource";
import { userRoleImportWorker } from "./functions/user-role-import-worker/resource";
import { pclabReservationHandler } from "./functions/pclab-reservation-handler/resource";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";


export const backend = defineBackend({
  auth,     // Ensure guest credentials are enabled in auth for anonymous uploads. :contentReference[oaicite:2]{index=2}
  data,
  storage,
  helloKla,
  listReservedHours,
  createReservation,
  notifyDeviceLoanRequest,
  createLoanAndNotify,
  adminUpsertRoleAssignment,
  adminImportUserAccounts,
  adminBulkUpdateUserRoles,
  adminDeleteUserRoleAssignments,
  adminSyncCognitoUsers,
  syncUserRolesPreToken,
  adminStartStudentProfileImport,
  studentProfileImportWorker,
  adminStartUserRoleImport,
  userRoleImportWorker,
  pclabReservationHandler,
});

const importBucketArn = backend.storage.resources.bucket.bucketArn;
const importBucketName = backend.storage.resources.bucket.bucketName;
const studentImportPrefix = "protected/admin/student-profile-imports";
const userRoleImportPrefix = "protected/admin/user-role-imports";

// Attach least-privilege SES send permission to the notification Lambda role.
backend.notifyDeviceLoanRequest.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["ses:SendEmail", "ses:SendRawEmail", "ses:SendTemplatedEmail"],
    resources: ["*"],
    conditions: {
      StringEquals: {
        "ses:FromAddress": "it@kla.education",
      },
    },
  })
);

backend.createLoanAndNotify.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["ses:SendEmail", "ses:SendRawEmail", "ses:SendTemplatedEmail"],
    resources: ["*"],
    conditions: {
      StringEquals: {
        "ses:FromAddress": "it@kla.education",
      },
    },
  })
);

backend.createLoanAndNotify.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["cognito-idp:ListUsersInGroup", "cognito-idp:AdminGetUser"],
    resources: [backend.auth.resources.userPool.userPoolArn],
  })
);

backend.createLoanAndNotify.addEnvironment("USER_POOL_ID", backend.auth.resources.userPool.userPoolId);

// Allow the function to list users in the Cognito User Pool to resolve ITAdmins group recipients
backend.notifyDeviceLoanRequest.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["cognito-idp:ListUsersInGroup", "cognito-idp:AdminGetUser"],
    resources: [backend.auth.resources.userPool.userPoolArn],
  })
);

// Provide USER_POOL_ID to the function as env
backend.notifyDeviceLoanRequest.addEnvironment(
  "USER_POOL_ID",
  backend.auth.resources.userPool.userPoolId
);

backend.adminUpsertRoleAssignment.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["cognito-idp:AdminGetUser"],
    resources: [backend.auth.resources.userPool.userPoolArn],
  })
);
backend.adminUpsertRoleAssignment.addEnvironment("USER_POOL_ID", backend.auth.resources.userPool.userPoolId);

backend.adminImportUserAccounts.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["cognito-idp:AdminGetUser"],
    resources: [backend.auth.resources.userPool.userPoolArn],
  })
);
backend.adminImportUserAccounts.addEnvironment("USER_POOL_ID", backend.auth.resources.userPool.userPoolId);

backend.adminBulkUpdateUserRoles.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["cognito-idp:AdminGetUser"],
    resources: [backend.auth.resources.userPool.userPoolArn],
  })
);
backend.adminBulkUpdateUserRoles.addEnvironment("USER_POOL_ID", backend.auth.resources.userPool.userPoolId);

// Bulk delete function relies solely on the Data API; no extra Cognito IAM grants required.

backend.adminSyncCognitoUsers.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["cognito-idp:ListUsers", "cognito-idp:AdminGetUser"],
    resources: [backend.auth.resources.userPool.userPoolArn],
  })
);
backend.adminSyncCognitoUsers.addEnvironment("USER_POOL_ID", backend.auth.resources.userPool.userPoolId);

backend.adminStartStudentProfileImport.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["s3:PutObject", "s3:AbortMultipartUpload"],
    resources: [`${importBucketArn}/${studentImportPrefix}/*`],
  })
);
backend.adminStartStudentProfileImport.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["lambda:InvokeFunction"],
    resources: [backend.studentProfileImportWorker.resources.lambda.functionArn],
  })
);
backend.studentProfileImportWorker.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
    resources: [`${importBucketArn}/${studentImportPrefix}/*`],
  })
);

backend.adminStartStudentProfileImport.addEnvironment("IMPORT_BUCKET_NAME", importBucketName);
backend.adminStartStudentProfileImport.addEnvironment("IMPORT_BUCKET_PREFIX", studentImportPrefix);
backend.adminStartStudentProfileImport.addEnvironment(
  "IMPORT_WORKER_FUNCTION_NAME",
  backend.studentProfileImportWorker.resources.lambda.functionName
);
backend.studentProfileImportWorker.addEnvironment("IMPORT_BUCKET_NAME", importBucketName);
backend.studentProfileImportWorker.addEnvironment("IMPORT_BUCKET_PREFIX", studentImportPrefix);

backend.adminStartUserRoleImport.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["s3:PutObject", "s3:AbortMultipartUpload"],
    resources: [`${importBucketArn}/${userRoleImportPrefix}/*`],
  })
);
backend.adminStartUserRoleImport.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["lambda:InvokeFunction"],
    resources: [backend.userRoleImportWorker.resources.lambda.functionArn],
  })
);
backend.userRoleImportWorker.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
    resources: [`${importBucketArn}/${userRoleImportPrefix}/*`],
  })
);

backend.adminStartUserRoleImport.addEnvironment("IMPORT_BUCKET_NAME", importBucketName);
backend.adminStartUserRoleImport.addEnvironment("IMPORT_BUCKET_PREFIX", userRoleImportPrefix);
backend.adminStartUserRoleImport.addEnvironment(
  "IMPORT_WORKER_FUNCTION_NAME",
  backend.userRoleImportWorker.resources.lambda.functionName
);
backend.userRoleImportWorker.addEnvironment("IMPORT_BUCKET_NAME", importBucketName);
backend.userRoleImportWorker.addEnvironment("IMPORT_BUCKET_PREFIX", userRoleImportPrefix);

// PC Lab reservation handler requires SES permissions to notify IT and submitters
backend.pclabReservationHandler.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["ses:SendEmail", "ses:SendRawEmail", "ses:SendTemplatedEmail"],
    resources: ["*"],
    conditions: {
      StringEquals: {
        "ses:FromAddress": ["services@kla.education", "it@kla.education"],
      },
    },
  })
);
backend.pclabReservationHandler.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["cognito-idp:ListUsersInGroup", "cognito-idp:AdminGetUser"],
    resources: [backend.auth.resources.userPool.userPoolArn],
  })
);
backend.pclabReservationHandler.addEnvironment("USER_POOL_ID", backend.auth.resources.userPool.userPoolId);
