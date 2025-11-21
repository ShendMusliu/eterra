// amplify/data/resource.ts
import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

import { listReservedHours } from "../functions/list-reserved-hours/resource";
import { createReservation } from "../functions/create-reservation/resource";
import { notifyDeviceLoanRequest } from "../functions/notify-device-loan-request/resource";
import { createLoanAndNotify } from "../functions/create-loan-and-notify/resource";
import { pclabReservationHandler } from "../functions/pclab-reservation-handler/resource";
import { adminUpsertRoleAssignment } from "../functions/admin-upsert-role-assignment/resource";
import { adminImportUserAccounts } from "../functions/admin-import-user-accounts/resource";
import { adminBulkUpdateUserRoles } from "../functions/admin-bulk-update-user-roles/resource";
import { adminDeleteUserRoleAssignments } from "../functions/admin-delete-user-role-assignments/resource";
import { adminSyncCognitoUsers } from "../functions/admin-sync-cognito-users/resource";
import { adminUpsertUserProfile } from "../functions/admin-upsert-user-profile/resource";
import { adminGetUserProfile } from "../functions/admin-get-user-profile/resource";
import { adminListUserProfiles } from "../functions/admin-list-user-profiles/resource";
import { adminDeleteUserProfile } from "../functions/admin-delete-user-profile/resource";
import { syncUserRolesPreToken } from "../functions/sync-user-roles-pre-token/resource";
import { adminStartStudentProfileImport } from "../functions/admin-start-student-profile-import/resource";
import { studentProfileImportWorker } from "../functions/student-profile-import-worker/resource";
import { adminStartUserRoleImport } from "../functions/admin-start-user-role-import/resource";
import { userRoleImportWorker } from "../functions/user-role-import-worker/resource";

/**
 * KLA Data schema (Amplify Gen 2)
 *
 * Privacy-safe reservations:
 * - Composite identifier [date, hour] prevents double-booking structurally.
 * - Public can CREATE via validated mutation but cannot READ Reservation PII.
 * - Public availability comes from listReservedHours(date) which returns ONLY hours.
 * - The listReservedHours & createReservation Lambdas are granted Data API access at the schema level.
 */
const BulkRoleUpdateResult = a.customType({
  updatedCount: a.integer().required(),
  failedCount: a.integer().required(),
  successes: a.json().required(),
  failures: a.json().required(),
});

const BulkDeleteResult = a.customType({
  deletedCount: a.integer().required(),
  failedCount: a.integer().required(),
  successes: a.json().required(),
  failures: a.json().required(),
});

const CognitoSyncFailure = a.customType({
  email: a.string(),
  reason: a.string().required(),
});

const CognitoSyncResult = a.customType({
  createdCount: a.integer().required(),
  skippedCount: a.integer().required(),
  missingEmailCount: a.integer().required(),
  failedCount: a.integer().required(),
  totalCognitoUsers: a.integer().required(),
  totalAssignmentsBefore: a.integer().required(),
  totalAssignmentsAfter: a.integer().required(),
  failures: a.ref("CognitoSyncFailure").array().required(),
});

const UserType = a.enum(["STUDENT", "STAFF", "PARENT", "OTHER"]);

const ProfileLifecycleStatus = a.enum(["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"]);
const StudentProfileImportStatus = a.enum(["QUEUED", "PROCESSING", "SUCCEEDED", "FAILED"]);
const UserRoleImportStatus = a.enum(["QUEUED", "PROCESSING", "SUCCEEDED", "FAILED"]);

const PCLabReservationStatus = a.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const);
const PCLabReservationSelfUpdateAction = a.enum(["UPDATE", "CANCEL"] as const);

const PCLabReservationSubmissionInput = a.customType({
  reservationDate: a.date().required(),
  startTime: a.string().required(),
  endTime: a.string().required(),
  fullName: a.string().required(),
  email: a.string().required(),
  pcsNeeded: a.integer().required(),
  numberOfStudents: a.integer(),
  needsMonitor: a.boolean().required(),
  extraComments: a.string(),
});

const PCLabReservationSelfUpdateInput = a.customType({
  id: a.id().required(),
  reservationDate: a.date(),
  startTime: a.string(),
  endTime: a.string(),
  fullName: a.string(),
  email: a.string(),
  pcsNeeded: a.integer(),
  numberOfStudents: a.integer(),
  needsMonitor: a.boolean(),
  extraComments: a.string(),
  action: a.ref("PCLabReservationSelfUpdateAction").required(),
});

const StudentProfile = a.customType({
  fullName: a.string().required(),
  dateOfBirth: a.date(),
  motherName: a.string(),
  motherEmail: a.string(),
  motherPhone: a.string(),
  motherProfession: a.string(),
  fatherName: a.string(),
  fatherEmail: a.string(),
  fatherPhone: a.string(),
  fatherProfession: a.string(),
  healthNotes: a.string(),
    receivesSocialAssistance: a.boolean(),
    livesWithBothParents: a.boolean(),
    livesWithParentsDetails: a.string(),
    comments: a.string(),
  homeAddress: a.string(),
  homeCity: a.string(),
});

const UserProfileListItem = a.customType({
  pk: a.string().required(),
  sk: a.string().required(),
  userId: a.id().required(),
  userType: a.ref("UserType").required(),
  status: a.ref("ProfileLifecycleStatus").required(),
  displayName: a.string(),
  legalName: a.string(),
  preferredName: a.string(),
  primaryEmail: a.string(),
  primaryEmailLower: a.string(),
  secondaryEmails: a.string().array(),
  phoneNumbers: a.string().array(),
  student: a.ref("StudentProfile"),
  studentGrade: a.integer(),
  tags: a.string().array(),
  notes: a.string(),
  archivedAt: a.datetime(),
  deactivatedAt: a.datetime(),
  completedAt: a.datetime(),
  lastReviewedAt: a.datetime(),
  updatedBySub: a.string(),
  updatedByEmail: a.string(),
  createdAt: a.datetime().required(),
  updatedAt: a.datetime().required(),
});

const UserProfileListResult = a.customType({
  items: a.ref("UserProfileListItem").array().required(),
  nextToken: a.string(),
});

const schema = a
  .schema({
    CognitoSyncFailure,
    CognitoSyncResult,
    UserType,
    ProfileLifecycleStatus,
    StudentProfileImportStatus,
    StudentProfile,
    UserProfileListItem,
    UserProfileListResult,
    UserRoleImportStatus,
    PCLabReservationStatus,
    PCLabReservationSelfUpdateAction,
    PCLabReservationSubmissionInput,
    PCLabReservationSelfUpdateInput,
    // ---------------- Role registry ----------------
    /**
     * UserRoleAssignment:
     * - `id` is a stable app-level identifier that exists before Cognito issues a `sub`.
     * - `primaryEmail` stores the admin-entered value; `primaryEmailLower` powers case-insensitive lookups.
     * - Supports pre-provisioned users (no `cognitoSub`) and SSO-linked accounts (with `cognitoSub`).
     * - `roles` aligns with Cognito group names; trigger Lambda syncs on sign-in.
     * - `verifiedEmails` can store aliases that should inherit the same roles.
     */
    UserRoleAssignment: a
      .model({
        id: a.id().required(),
        primaryEmail: a.string().required(),
        primaryEmailLower: a.string().required(),
        roles: a.string().array().required(),
        verifiedEmails: a.string().array(),
        cognitoSub: a.string(), // populated after first successful sign-in
        notes: a.string(),
        updatedBySub: a.string(),
        updatedByEmail: a.string(),
      })
      .identifier(["id"])
      .secondaryIndexes((index) => [
        index("primaryEmailLower")
          .name("byPrimaryEmailLower")
          .queryField("listUserRoleAssignmentsByPrimaryEmailLower"),
        index("cognitoSub").name("byCognitoSub").queryField("listUserRoleAssignmentsByCognitoSub"),
      ])
      .authorization((allow) => [
        allow.groups(["Admin", "ITAdmins"]).to(["create", "read", "update", "delete"]),
      ]),
    /**
     * UserProfile:
     * - Single-table pattern using [pk=USER#{userId}, sk=PROFILE] for the primary profile record.
     * - `userId` links back to Cognito/app user identifiers; `userType` distinguishes persona-specific details.
     * - `student` embeds structured student-specific data; additional persona objects can be added later.
     * - Lifecycle fields (`status`, `archivedAt`, etc.) support future archival, soft-delete, and onboarding flows.
     */
    UserProfile: a
      .model({
        pk: a.string().required(),
        sk: a.string().required(),
        userId: a.id().required(),
        userType: a.ref("UserType").required(),
        status: a.ref("ProfileLifecycleStatus").required(),
        displayName: a.string(),
        legalName: a.string(),
        preferredName: a.string(),
        primaryEmail: a.string(),
        primaryEmailLower: a.string(),
        secondaryEmails: a.string().array(),
        phoneNumbers: a.string().array(),
        student: a.ref("StudentProfile"),
        studentGrade: a.integer(),
        tags: a.string().array(),
        notes: a.string(),
        archivedAt: a.datetime(),
        deactivatedAt: a.datetime(),
        completedAt: a.datetime(),
        lastReviewedAt: a.datetime(),
        updatedBySub: a.string(),
        updatedByEmail: a.string(),
      })
      .identifier(["pk", "sk"])
      .secondaryIndexes((index) => [
        index("userId").name("byUserId").queryField("getUserProfileByUserId"),
        index("userType").name("byUserType").queryField("listUserProfilesByUserType"),
        index("primaryEmailLower")
          .name("byPrimaryEmailLowerProfile")
          .queryField("listUserProfilesByPrimaryEmailLower"),
      ])
      .authorization((allow) => [
        allow.groups(["Admin", "HR"]).to(["create", "read", "update", "delete"]),
      ]),
    StudentProfileImportJob: a
      .model({
        id: a.id().required(),
        status: a.ref("StudentProfileImportStatus").required(),
        sourceFilename: a.string(),
        csvS3Key: a.string().required(),
        resultS3Key: a.string(),
        totalRows: a.integer(),
        processedRows: a.integer(),
        successCount: a.integer(),
        failureCount: a.integer(),
        message: a.string(),
        createdBySub: a.string(),
        createdByEmail: a.string(),
        startedAt: a.datetime(),
        completedAt: a.datetime(),
      })
      .identifier(["id"])
      .authorization((allow) => [
        allow.groups(["Admin", "HR"]).to(["create", "read", "update"]),
      ]),
    adminGetUserProfile: a
      .query()
      .arguments({
        userId: a.id().required(),
      })
      .returns(a.ref("UserProfile"))
      .authorization((allow) => [allow.groups(["Admin", "HR"])])
      .handler(a.handler.function(adminGetUserProfile)),
    adminListUserProfiles: a
      .query()
      .arguments({
        userType: a.ref("UserType"),
        status: a.ref("ProfileLifecycleStatus"),
        search: a.string(),
        nameContains: a.string(),
        email: a.string(),
        grade: a.integer(),
        dateOfBirthFrom: a.date(),
        dateOfBirthTo: a.date(),
        updatedFrom: a.datetime(),
        updatedTo: a.datetime(),
        limit: a.integer(),
        nextToken: a.string(),
      })
      .returns(a.ref("UserProfileListResult"))
      .authorization((allow) => [allow.groups(["Admin", "HR"])])
      .handler(a.handler.function(adminListUserProfiles)),
    adminUpsertUserProfile: a
      .mutation()
      .arguments({
        userId: a.id().required(),
        userType: a.ref("UserType").required(),
        status: a.ref("ProfileLifecycleStatus"),
        displayName: a.string(),
        legalName: a.string(),
        preferredName: a.string(),
        primaryEmail: a.string(),
        secondaryEmails: a.string().array(),
        phoneNumbers: a.string().array(),
        student: a.ref("StudentProfile"),
        tags: a.string().array(),
        notes: a.string(),
        archivedAt: a.datetime(),
        deactivatedAt: a.datetime(),
        completedAt: a.datetime(),
        lastReviewedAt: a.datetime(),
      })
      .returns(a.ref("UserProfile"))
      .authorization((allow) => [allow.groups(["Admin", "HR"])])
      .handler(a.handler.function(adminUpsertUserProfile)),
    adminDeleteUserProfile: a
      .mutation()
      .arguments({
        userId: a.id().required(),
      })
      .returns(a.boolean().required())
      .authorization((allow) => [allow.groups(["Admin", "HR"])])
      .handler(a.handler.function(adminDeleteUserProfile)),
    UserRoleImportJob: a
      .model({
        id: a.id().required(),
        status: a.ref("UserRoleImportStatus").required(),
        sourceFilename: a.string(),
        csvS3Key: a.string().required(),
        resultS3Key: a.string(),
        totalRows: a.integer(),
        processedRows: a.integer(),
        successCount: a.integer(),
        failureCount: a.integer(),
        message: a.string(),
        createdBySub: a.string(),
        createdByEmail: a.string(),
        startedAt: a.datetime(),
        completedAt: a.datetime(),
      })
      .identifier(["id"])
      .authorization((allow) => [allow.groups(["Admin", "ITAdmins"])]),
    adminStartStudentProfileImport: a
      .mutation()
      .arguments({
        csv: a.string().required(),
        fileName: a.string(),
      })
      .returns(a.ref("StudentProfileImportJob"))
      .authorization((allow) => [allow.groups(["Admin", "HR"])])
      .handler(a.handler.function(adminStartStudentProfileImport)),
    adminStartUserRoleImport: a
      .mutation()
      .arguments({
        csv: a.string().required(),
        fileName: a.string(),
      })
      .returns(a.ref("UserRoleImportJob"))
      .authorization((allow) => [allow.groups(["Admin", "ITAdmins"])])
      .handler(a.handler.function(adminStartUserRoleImport)),
    CognitoSyncState: a
      .model({
        id: a.string().required(),
        lastRunAt: a.datetime().required(),
        updatedBySub: a.string(),
        updatedByEmail: a.string(),
      })
      .identifier(["id"])
      .authorization((allow) => [
        allow.groups(["Admin", "ITAdmins"]).to(["create", "read", "update"]),
      ]),
    adminUpsertUserRoleAssignment: a
      .mutation()
      .arguments({
        userId: a.id(),
        primaryEmail: a.string().required(),
        roles: a.string().array().required(),
        verifiedEmails: a.string().array(),
        cognitoSub: a.string(),
        notes: a.string(),
      })
      .returns(a.ref("UserRoleAssignment"))
      .authorization((allow) => [allow.groups(["Admin", "ITAdmins"])])
      .handler(a.handler.function(adminUpsertRoleAssignment)),
    adminImportUserAccounts: a
      .mutation()
      .arguments({
        csv: a.string().required(),
      })
      .returns(a.string().required())
      .authorization((allow) => [allow.groups(["Admin", "ITAdmins"])])
      .handler(a.handler.function(adminImportUserAccounts)),
    adminBulkUpdateUserRoles: a
      .mutation()
      .arguments({
        primaryEmails: a.string().array().required(),
        roles: a.string().array().required(),
        action: a.string().required(),
      })
      .returns(BulkRoleUpdateResult)
      .authorization((allow) => [allow.groups(["Admin", "ITAdmins"])])
      .handler(a.handler.function(adminBulkUpdateUserRoles)),
    adminDeleteUserRoleAssignments: a
      .mutation()
      .arguments({
        primaryEmails: a.string().array().required(),
      })
      .returns(BulkDeleteResult)
      .authorization((allow) => [allow.groups(["Admin", "ITAdmins"])])
      .handler(a.handler.function(adminDeleteUserRoleAssignments)),
    adminSyncCognitoUsers: a
      .mutation()
      .returns(CognitoSyncResult)
      .authorization((allow) => [allow.groups(["Admin", "ITAdmins"])])
      .handler(a.handler.function(adminSyncCognitoUsers)),
    // ---------------- Existing models ----------------
    StudentApplication: a
      .model({
        // Core applicant info
        fullName: a.string().required(),
        dob: a.string().required(), // YYYY-MM-DD
        email: a.string(),
        phone: a.string(),
        desiredGrade: a.string().required(),

        // Optional legacy fields (kept for compatibility with older UIs)
        currentSchool: a.string(),
        parentName: a.string(),
        parentEmail: a.string(),
        parentPhone: a.string(),

        // New fields from the updated public form
        gender: a.string(),
        city: a.string(),
        address: a.string(),
        livesWithParents: a.string(), // e.g., "Po" | "Jo"
        livesWithParentsComment: a.string(),
        medicalNotes: a.string(),

        // Parent/guardian details
        motherName: a.string(),
        motherEmail: a.string(),
        motherPhone: a.string(),
        motherJob: a.string(),
        fatherName: a.string(),
        fatherEmail: a.string(),
        fatherPhone: a.string(),
        fatherJob: a.string(),

        socialAssistance: a.string(), // e.g., "Po" | "Jo"

        motivation: a.string().required(),
        comments: a.string(),
      })
      .authorization((allow) => [
        allow.publicApiKey().to(["create"]), // public can submit
        allow.groups(["Admin"]).to(["read"]), // staff review
        allow.owner().to(["read"]), // if submitted while signed in
      ]),

    WorkApplication: a
      .model({
        fullName: a.string().required(),
        email: a.string().required(),
        phone: a.string().required(),
        position: a.string().required(),
        coverLetter: a.string().required(),
        resumeKey: a.string().required(), // required to match UI validation
        comments: a.string(),
      })
      .authorization((allow) => [
        allow.publicApiKey().to(["create"]), // public job form
        allow.groups(["Admin", "HR"]).to(["read"]), // staff review
        allow.owner().to(["read"]), // future: viewing when signed in
      ]),

    // ---------------- Dashboard preferences ----------------
    DashboardPreference: a
      .model({
        owner: a.string().required(),
        favoriteFeatureKeys: a.string().array().required(),
      })
      .identifier(["owner"])
      .authorization((allow) => [
        allow.owner().to(["create", "read", "update", "delete"]),
      ]),
    // ---------------- Device Loan Requests ----------------
    // Status enum for type-safety
    DeviceLoanStatus: a.enum(["PENDING", "APPROVED", "REJECTED"] as const),
    /**
     * DeviceLoanRequest:
     * - Owner can create and read own requests.
     * - IT and Admin can read; status/notes updates must go through the setDeviceLoanStatus mutation.
     * - Admin can delete (e.g., cleanup).
     * - Dates use AWSDate ("YYYY-MM-DD").
     */
    DeviceLoanRequest: a
      .model({
        owner: a.string().required(), // owner field for owner-based auth
        email: a.string().required(),
        fullName: a.string().required(),
        grade: a.string(), // optional, populated for students
        reason: a.string().required(),
        borrowDate: a.date().required(),
        returnDate: a.date().required(),
        status: a.ref("DeviceLoanStatus").required(),
        requesterId: a.string().required(), // cognito:username or sub
        notes: a.string(), // IT/Admin notes
      })
      .authorization((allow) => [
        allow.owner().to(["create", "read"]),
        allow.group("ITAdmins").to(["read"]),
        allow.group("Admin").to(["read", "delete"]),
      ]),

    // Audit trail for status changes
    DeviceLoanEvent: a
      .model({
        requestId: a.id().required(),
        owner: a.string().required(),
        changedAt: a.datetime().required(),
        changedBySub: a.string().required(),
        changedByName: a.string(),
        changedByEmail: a.string(),
        changedByGroups: a.string().array(),
        oldStatus: a.ref("DeviceLoanStatus"),
        newStatus: a.ref("DeviceLoanStatus").required(),
        notes: a.string(),
      })
      .authorization((allow) => [
        allow.groups(["ITAdmins", "Admin"]).to(["read", "create"]),
        allow.owner().to(["read"]),
      ]),

    // ---------------- PC Lab Reservations ----------------
    PCLabReservation: a
      .model({
        id: a.id().required(),
        owner: a.string().required(),
        requesterId: a.string().required(),
        requesterEmail: a.string(),
        requesterName: a.string(),
        fullName: a.string().required(),
        email: a.string().required(),
        reservationDate: a.date().required(),
        startTime: a.string().required(),
        endTime: a.string().required(),
        pcsNeeded: a.integer().required(),
        numberOfStudents: a.integer(),
        needsMonitor: a.boolean().required(),
        extraComments: a.string(),
        status: a.ref("PCLabReservationStatus").required(),
        statusNotes: a.string(),
        reviewedBySub: a.string(),
        reviewedByName: a.string(),
        reviewedAt: a.datetime(),
      })
      .identifier(["id"])
      .secondaryIndexes((index) => [
        index("owner")
          .name("pclabReservationsByOwner")
          .queryField("listPCLabReservationsByOwner"),
        index("reservationDate")
          .name("pclabReservationsByDate")
          .queryField("listPCLabReservationsByDate"),
        index("status")
          .name("pclabReservationsByStatus")
          .queryField("listPCLabReservationsByStatus"),
      ])
      .authorization((allow) => [
        allow.owner().to(["read"]),
        allow.groups(["Admin", "ITAdmins"]).to(["create", "read", "update", "delete"]),
      ]),
    PCLabReservationEvent: a
      .model({
        reservationId: a.id().required(),
        owner: a.string().required(),
        changedAt: a.datetime().required(),
        changedBySub: a.string().required(),
        changedByName: a.string(),
        changedByEmail: a.string(),
        changedByGroups: a.string().array(),
        oldStatus: a.ref("PCLabReservationStatus"),
        newStatus: a.ref("PCLabReservationStatus").required(),
        notes: a.string(),
      })
      .authorization((allow) => [
        allow.groups(["Admin", "ITAdmins"]).to(["read", "create"]),
        allow.owner().to(["read"]),
      ]),

    // ---------------- Sports Field Reservations ----------------
    /**
     * Reservation:
     * - date: AWSDate ("YYYY-MM-DD")
     * - hour: 0..23, representing HH:00 to HH:59 slot
     * - Contact fields are PII; not exposed to public reads
     * - Primary key: [date, hour] - structurally prevents double bookings
     * - createdAt/updatedAt are added automatically by Amplify
     */
    Reservation: a
      .model({
        date: a.date().required(), // "YYYY-MM-DD"
        hour: a.integer().required(), // 0..23
        fullName: a.string(),
        email: a.string(),
        phone: a.string(),
        comments: a.string(),
        owner: a.string(), // Cognito username for signed-in submitter
        requesterId: a.string(), // Cognito sub for reliable filtering
        requesterEmail: a.string(),
        requesterName: a.string(),
      })
      .identifier(["date", "hour"])
      .authorization((allow) => [
        // Owner can read their own submissions
        allow.owner().to(["read"]),
        // Staff cleanup powers
        allow.groups(["Admin", "HR"]).to(["read", "delete"]),
      ]),

    // ---------------- Public, PII-safe availability query ----------------
    /**
     * listReservedHours(date): [Int!]!
     * Returns only the taken hours (0..23) for a given date - no PII.
     * Public and authenticated users can call this.
     */
    listReservedHours: a
      .query()
      .arguments({ date: a.date().required() })
      .returns(a.integer().array().required())
      .authorization((allow) => [allow.publicApiKey(), allow.authenticated()])
      .handler(a.handler.function(listReservedHours)),

    // Validated public mutation to create a reservation
    createReservationValidated: a
      .mutation()
      .arguments({
        date: a.date().required(),
        hour: a.integer().required(),
        fullName: a.string().required(),
        email: a.string().required(),
        phone: a.string(),
        comments: a.string(),
      })
      .returns(a.integer().required())
      .authorization((allow) => [allow.publicApiKey(), allow.authenticated()])
      .handler(a.handler.function(createReservation)),

    // Send email notification for a DeviceLoanRequest by id
    notifyDeviceLoanRequest: a
      .mutation()
      .arguments({ id: a.id().required() })
      .returns(a.boolean().required())
      .authorization((allow) => [
        // Frontend calls this after create; any signed-in user can invoke,
        // but the function enforces owner/Admin/ITAdmins check on the item.
        allow.authenticated(),
      ])
      .handler(a.handler.function(notifyDeviceLoanRequest)),

    // Create a loan and notify ITAdmins in one server-side operation
    createDeviceLoanAndNotify: a
      .mutation()
      .arguments({
        reason: a.string().required(),
        borrowDate: a.date().required(),
        returnDate: a.date().required(),
        grade: a.string(),
        email: a.string(),
        fullName: a.string(),
      })
      .returns(a.ref("DeviceLoanRequest"))
      .authorization((allow) => [allow.authenticated()])
      .handler(a.handler.function(createLoanAndNotify)),

    // Admin/IT mutation to set status with audit trail
    setDeviceLoanStatus: a
      .mutation()
      .arguments({ id: a.id().required(), status: a.ref("DeviceLoanStatus").required(), notes: a.string() })
      .returns(a.ref("DeviceLoanRequest"))
      .authorization((allow) => [allow.groups(["ITAdmins", "Admin"])])
      .handler(a.handler.function(createLoanAndNotify)), // reuse function file to reduce boilerplate; it branches by args
    createPCLabReservationRequest: a
      .mutation()
      .arguments({ input: a.ref("PCLabReservationSubmissionInput").required() })
      .returns(a.ref("PCLabReservation"))
      .authorization((allow) => [allow.groups(["Teacher", "Admin", "ITAdmins"])])
      .handler(a.handler.function(pclabReservationHandler)),
    updateOwnPCLabReservation: a
      .mutation()
      .arguments({ input: a.ref("PCLabReservationSelfUpdateInput").required() })
      .returns(a.ref("PCLabReservation"))
      .authorization((allow) => [allow.groups(["Teacher", "Admin", "ITAdmins"])])
      .handler(a.handler.function(pclabReservationHandler)),
    setPCLabReservationStatus: a
      .mutation()
      .arguments({
        id: a.id().required(),
        status: a.ref("PCLabReservationStatus").required(),
        statusNotes: a.string(),
      })
      .returns(a.ref("PCLabReservation"))
      .authorization((allow) => [allow.groups(["Admin", "ITAdmins"])])
      .handler(a.handler.function(pclabReservationHandler)),
  })
  // Grant functions permission to the Data API (function access is schema-level only)
  .authorization((allow) => [
    allow.resource(listReservedHours).to(["query"]),
    allow.resource(createReservation).to(["mutate"]), // create/update/delete via Data API
    allow.resource(notifyDeviceLoanRequest).to(["mutate", "query"]),
    allow.resource(createLoanAndNotify).to(["mutate", "query"]),
    allow.resource(pclabReservationHandler).to(["mutate", "query"]),
    allow.resource(adminUpsertRoleAssignment).to(["mutate", "query"]),
    allow.resource(adminImportUserAccounts).to(["mutate", "query"]),
    allow.resource(adminBulkUpdateUserRoles).to(["mutate", "query"]),
    allow.resource(adminDeleteUserRoleAssignments).to(["mutate", "query"]),
    allow.resource(adminSyncCognitoUsers).to(["mutate", "query"]),
    allow.resource(adminGetUserProfile).to(["query"]),
    allow.resource(adminListUserProfiles).to(["query"]),
    allow.resource(adminUpsertUserProfile).to(["mutate", "query"]),
    allow.resource(adminDeleteUserProfile).to(["mutate", "query"]),
    allow.resource(syncUserRolesPreToken).to(["query"]),
    allow.resource(adminStartStudentProfileImport).to(["mutate", "query"]),
    allow.resource(studentProfileImportWorker).to(["mutate", "query"]),
    allow.resource(adminStartUserRoleImport).to(["mutate", "query"]),
    allow.resource(userRoleImportWorker).to(["mutate", "query"]),
  ]);

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    // Public forms / reads use API key by default (guests supported for allowed ops)
    defaultAuthorizationMode: "apiKey",
    apiKeyAuthorizationMode: { expiresInDays: 30 },
  },
});

