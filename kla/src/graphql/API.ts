/* tslint:disable */
/* eslint-disable */
//  This file was automatically generated and should not be edited.

export type CognitoSyncState = {
  __typename: "CognitoSyncState",
  createdAt: string,
  id: string,
  lastRunAt: string,
  updatedAt: string,
  updatedByEmail?: string | null,
  updatedBySub?: string | null,
};

export type DashboardPreference = {
  __typename: "DashboardPreference",
  createdAt: string,
  favoriteFeatureKeys: Array< string | null >,
  owner: string,
  updatedAt: string,
};

export type DeviceLoanEvent = {
  __typename: "DeviceLoanEvent",
  changedAt: string,
  changedByEmail?: string | null,
  changedByGroups?: Array< string | null > | null,
  changedByName?: string | null,
  changedBySub: string,
  createdAt: string,
  id: string,
  newStatus: DeviceLoanStatus,
  notes?: string | null,
  oldStatus?: DeviceLoanStatus | null,
  owner: string,
  requestId: string,
  updatedAt: string,
};

export enum DeviceLoanStatus {
  APPROVED = "APPROVED",
  PENDING = "PENDING",
  REJECTED = "REJECTED",
}


export type DeviceLoanRequest = {
  __typename: "DeviceLoanRequest",
  borrowDate: string,
  createdAt: string,
  email: string,
  fullName: string,
  grade?: string | null,
  id: string,
  notes?: string | null,
  owner: string,
  reason: string,
  requesterId: string,
  returnDate: string,
  status: DeviceLoanStatus,
  updatedAt: string,
};

export type Reservation = {
  __typename: "Reservation",
  comments?: string | null,
  createdAt: string,
  date: string,
  email?: string | null,
  fullName?: string | null,
  hour: number,
  owner?: string | null,
  phone?: string | null,
  requesterEmail?: string | null,
  requesterId?: string | null,
  requesterName?: string | null,
  updatedAt: string,
};

export type StudentApplication = {
  __typename: "StudentApplication",
  address?: string | null,
  city?: string | null,
  comments?: string | null,
  createdAt: string,
  currentSchool?: string | null,
  desiredGrade: string,
  dob: string,
  email?: string | null,
  fatherEmail?: string | null,
  fatherJob?: string | null,
  fatherName?: string | null,
  fatherPhone?: string | null,
  fullName: string,
  gender?: string | null,
  id: string,
  livesWithParents?: string | null,
  livesWithParentsComment?: string | null,
  medicalNotes?: string | null,
  motherEmail?: string | null,
  motherJob?: string | null,
  motherName?: string | null,
  motherPhone?: string | null,
  motivation: string,
  owner?: string | null,
  parentEmail?: string | null,
  parentName?: string | null,
  parentPhone?: string | null,
  phone?: string | null,
  socialAssistance?: string | null,
  updatedAt: string,
};

export type UserProfile = {
  __typename: "UserProfile",
  archivedAt?: string | null,
  completedAt?: string | null,
  createdAt: string,
  deactivatedAt?: string | null,
  displayName?: string | null,
  lastReviewedAt?: string | null,
  legalName?: string | null,
  notes?: string | null,
  phoneNumbers?: Array< string | null > | null,
  pk: string,
  preferredName?: string | null,
  primaryEmail?: string | null,
  primaryEmailLower?: string | null,
  secondaryEmails?: Array< string | null > | null,
  sk: string,
  status: ProfileLifecycleStatus,
  student?: StudentProfile | null,
  tags?: Array< string | null > | null,
  updatedAt: string,
  updatedByEmail?: string | null,
  updatedBySub?: string | null,
  userId: string,
  userType: UserType,
};

export enum ProfileLifecycleStatus {
  ACTIVE = "ACTIVE",
  ARCHIVED = "ARCHIVED",
  DRAFT = "DRAFT",
  INACTIVE = "INACTIVE",
}


export type StudentProfile = {
  __typename: "StudentProfile",
  comments?: string | null,
  dateOfBirth?: string | null,
  fatherEmail?: string | null,
  fatherName?: string | null,
  fatherPhone?: string | null,
  fatherProfession?: string | null,
  fullName: string,
  healthNotes?: string | null,
  homeAddress?: string | null,
  homeCity?: string | null,
  livesWithBothParents?: boolean | null,
  motherEmail?: string | null,
  motherName?: string | null,
  motherPhone?: string | null,
  motherProfession?: string | null,
  receivesSocialAssistance?: boolean | null,
};

export enum UserType {
  OTHER = "OTHER",
  PARENT = "PARENT",
  STAFF = "STAFF",
  STUDENT = "STUDENT",
}


export type ModelUserProfileFilterInput = {
  and?: Array< ModelUserProfileFilterInput | null > | null,
  archivedAt?: ModelStringInput | null,
  completedAt?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  deactivatedAt?: ModelStringInput | null,
  displayName?: ModelStringInput | null,
  id?: ModelIDInput | null,
  lastReviewedAt?: ModelStringInput | null,
  legalName?: ModelStringInput | null,
  not?: ModelUserProfileFilterInput | null,
  notes?: ModelStringInput | null,
  or?: Array< ModelUserProfileFilterInput | null > | null,
  phoneNumbers?: ModelStringInput | null,
  pk?: ModelStringInput | null,
  preferredName?: ModelStringInput | null,
  primaryEmail?: ModelStringInput | null,
  primaryEmailLower?: ModelStringInput | null,
  secondaryEmails?: ModelStringInput | null,
  sk?: ModelStringInput | null,
  status?: ModelProfileLifecycleStatusInput | null,
  tags?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  updatedByEmail?: ModelStringInput | null,
  updatedBySub?: ModelStringInput | null,
  userId?: ModelIDInput | null,
  userType?: ModelUserTypeInput | null,
};

export type ModelStringInput = {
  attributeExists?: boolean | null,
  attributeType?: ModelAttributeTypes | null,
  beginsWith?: string | null,
  between?: Array< string | null > | null,
  contains?: string | null,
  eq?: string | null,
  ge?: string | null,
  gt?: string | null,
  le?: string | null,
  lt?: string | null,
  ne?: string | null,
  notContains?: string | null,
  size?: ModelSizeInput | null,
};

export enum ModelAttributeTypes {
  _null = "_null",
  binary = "binary",
  binarySet = "binarySet",
  bool = "bool",
  list = "list",
  map = "map",
  number = "number",
  numberSet = "numberSet",
  string = "string",
  stringSet = "stringSet",
}


export type ModelSizeInput = {
  between?: Array< number | null > | null,
  eq?: number | null,
  ge?: number | null,
  gt?: number | null,
  le?: number | null,
  lt?: number | null,
  ne?: number | null,
};

export type ModelIDInput = {
  attributeExists?: boolean | null,
  attributeType?: ModelAttributeTypes | null,
  beginsWith?: string | null,
  between?: Array< string | null > | null,
  contains?: string | null,
  eq?: string | null,
  ge?: string | null,
  gt?: string | null,
  le?: string | null,
  lt?: string | null,
  ne?: string | null,
  notContains?: string | null,
  size?: ModelSizeInput | null,
};

export type ModelProfileLifecycleStatusInput = {
  eq?: ProfileLifecycleStatus | null,
  ne?: ProfileLifecycleStatus | null,
};

export type ModelUserTypeInput = {
  eq?: UserType | null,
  ne?: UserType | null,
};

export enum ModelSortDirection {
  ASC = "ASC",
  DESC = "DESC",
}


export type ModelUserProfileConnection = {
  __typename: "ModelUserProfileConnection",
  items:  Array<UserProfile | null >,
  nextToken?: string | null,
};

export type UserRoleAssignment = {
  __typename: "UserRoleAssignment",
  cognitoSub?: string | null,
  createdAt: string,
  id: string,
  notes?: string | null,
  primaryEmail: string,
  primaryEmailLower: string,
  roles: Array< string | null >,
  updatedAt: string,
  updatedByEmail?: string | null,
  updatedBySub?: string | null,
  verifiedEmails?: Array< string | null > | null,
};

export type WorkApplication = {
  __typename: "WorkApplication",
  comments?: string | null,
  coverLetter: string,
  createdAt: string,
  email: string,
  fullName: string,
  id: string,
  owner?: string | null,
  phone: string,
  position: string,
  resumeKey: string,
  updatedAt: string,
};

export type ModelCognitoSyncStateFilterInput = {
  and?: Array< ModelCognitoSyncStateFilterInput | null > | null,
  createdAt?: ModelStringInput | null,
  id?: ModelStringInput | null,
  lastRunAt?: ModelStringInput | null,
  not?: ModelCognitoSyncStateFilterInput | null,
  or?: Array< ModelCognitoSyncStateFilterInput | null > | null,
  updatedAt?: ModelStringInput | null,
  updatedByEmail?: ModelStringInput | null,
  updatedBySub?: ModelStringInput | null,
};

export type ModelCognitoSyncStateConnection = {
  __typename: "ModelCognitoSyncStateConnection",
  items:  Array<CognitoSyncState | null >,
  nextToken?: string | null,
};

export type ModelDashboardPreferenceFilterInput = {
  and?: Array< ModelDashboardPreferenceFilterInput | null > | null,
  createdAt?: ModelStringInput | null,
  favoriteFeatureKeys?: ModelStringInput | null,
  id?: ModelIDInput | null,
  not?: ModelDashboardPreferenceFilterInput | null,
  or?: Array< ModelDashboardPreferenceFilterInput | null > | null,
  owner?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
};

export type ModelDashboardPreferenceConnection = {
  __typename: "ModelDashboardPreferenceConnection",
  items:  Array<DashboardPreference | null >,
  nextToken?: string | null,
};

export type ModelDeviceLoanEventFilterInput = {
  and?: Array< ModelDeviceLoanEventFilterInput | null > | null,
  changedAt?: ModelStringInput | null,
  changedByEmail?: ModelStringInput | null,
  changedByGroups?: ModelStringInput | null,
  changedByName?: ModelStringInput | null,
  changedBySub?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  id?: ModelIDInput | null,
  newStatus?: ModelDeviceLoanStatusInput | null,
  not?: ModelDeviceLoanEventFilterInput | null,
  notes?: ModelStringInput | null,
  oldStatus?: ModelDeviceLoanStatusInput | null,
  or?: Array< ModelDeviceLoanEventFilterInput | null > | null,
  owner?: ModelStringInput | null,
  requestId?: ModelIDInput | null,
  updatedAt?: ModelStringInput | null,
};

export type ModelDeviceLoanStatusInput = {
  eq?: DeviceLoanStatus | null,
  ne?: DeviceLoanStatus | null,
};

export type ModelDeviceLoanEventConnection = {
  __typename: "ModelDeviceLoanEventConnection",
  items:  Array<DeviceLoanEvent | null >,
  nextToken?: string | null,
};

export type ModelDeviceLoanRequestFilterInput = {
  and?: Array< ModelDeviceLoanRequestFilterInput | null > | null,
  borrowDate?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  email?: ModelStringInput | null,
  fullName?: ModelStringInput | null,
  grade?: ModelStringInput | null,
  id?: ModelIDInput | null,
  not?: ModelDeviceLoanRequestFilterInput | null,
  notes?: ModelStringInput | null,
  or?: Array< ModelDeviceLoanRequestFilterInput | null > | null,
  owner?: ModelStringInput | null,
  reason?: ModelStringInput | null,
  requesterId?: ModelStringInput | null,
  returnDate?: ModelStringInput | null,
  status?: ModelDeviceLoanStatusInput | null,
  updatedAt?: ModelStringInput | null,
};

export type ModelDeviceLoanRequestConnection = {
  __typename: "ModelDeviceLoanRequestConnection",
  items:  Array<DeviceLoanRequest | null >,
  nextToken?: string | null,
};

export type ModelReservationFilterInput = {
  and?: Array< ModelReservationFilterInput | null > | null,
  comments?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  date?: ModelStringInput | null,
  email?: ModelStringInput | null,
  fullName?: ModelStringInput | null,
  hour?: ModelIntInput | null,
  id?: ModelIDInput | null,
  not?: ModelReservationFilterInput | null,
  or?: Array< ModelReservationFilterInput | null > | null,
  owner?: ModelStringInput | null,
  phone?: ModelStringInput | null,
  requesterEmail?: ModelStringInput | null,
  requesterId?: ModelStringInput | null,
  requesterName?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
};

export type ModelIntInput = {
  attributeExists?: boolean | null,
  attributeType?: ModelAttributeTypes | null,
  between?: Array< number | null > | null,
  eq?: number | null,
  ge?: number | null,
  gt?: number | null,
  le?: number | null,
  lt?: number | null,
  ne?: number | null,
};

export type ModelIntKeyConditionInput = {
  between?: Array< number | null > | null,
  eq?: number | null,
  ge?: number | null,
  gt?: number | null,
  le?: number | null,
  lt?: number | null,
};

export type ModelReservationConnection = {
  __typename: "ModelReservationConnection",
  items:  Array<Reservation | null >,
  nextToken?: string | null,
};

export type ModelStudentApplicationFilterInput = {
  address?: ModelStringInput | null,
  and?: Array< ModelStudentApplicationFilterInput | null > | null,
  city?: ModelStringInput | null,
  comments?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  currentSchool?: ModelStringInput | null,
  desiredGrade?: ModelStringInput | null,
  dob?: ModelStringInput | null,
  email?: ModelStringInput | null,
  fatherEmail?: ModelStringInput | null,
  fatherJob?: ModelStringInput | null,
  fatherName?: ModelStringInput | null,
  fatherPhone?: ModelStringInput | null,
  fullName?: ModelStringInput | null,
  gender?: ModelStringInput | null,
  id?: ModelIDInput | null,
  livesWithParents?: ModelStringInput | null,
  livesWithParentsComment?: ModelStringInput | null,
  medicalNotes?: ModelStringInput | null,
  motherEmail?: ModelStringInput | null,
  motherJob?: ModelStringInput | null,
  motherName?: ModelStringInput | null,
  motherPhone?: ModelStringInput | null,
  motivation?: ModelStringInput | null,
  not?: ModelStudentApplicationFilterInput | null,
  or?: Array< ModelStudentApplicationFilterInput | null > | null,
  owner?: ModelStringInput | null,
  parentEmail?: ModelStringInput | null,
  parentName?: ModelStringInput | null,
  parentPhone?: ModelStringInput | null,
  phone?: ModelStringInput | null,
  socialAssistance?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
};

export type ModelStudentApplicationConnection = {
  __typename: "ModelStudentApplicationConnection",
  items:  Array<StudentApplication | null >,
  nextToken?: string | null,
};

export type ModelStringKeyConditionInput = {
  beginsWith?: string | null,
  between?: Array< string | null > | null,
  eq?: string | null,
  ge?: string | null,
  gt?: string | null,
  le?: string | null,
  lt?: string | null,
};

export type ModelUserRoleAssignmentFilterInput = {
  and?: Array< ModelUserRoleAssignmentFilterInput | null > | null,
  cognitoSub?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  id?: ModelIDInput | null,
  not?: ModelUserRoleAssignmentFilterInput | null,
  notes?: ModelStringInput | null,
  or?: Array< ModelUserRoleAssignmentFilterInput | null > | null,
  primaryEmail?: ModelStringInput | null,
  primaryEmailLower?: ModelStringInput | null,
  roles?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  updatedByEmail?: ModelStringInput | null,
  updatedBySub?: ModelStringInput | null,
  verifiedEmails?: ModelStringInput | null,
};

export type ModelUserRoleAssignmentConnection = {
  __typename: "ModelUserRoleAssignmentConnection",
  items:  Array<UserRoleAssignment | null >,
  nextToken?: string | null,
};

export type ModelWorkApplicationFilterInput = {
  and?: Array< ModelWorkApplicationFilterInput | null > | null,
  comments?: ModelStringInput | null,
  coverLetter?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  email?: ModelStringInput | null,
  fullName?: ModelStringInput | null,
  id?: ModelIDInput | null,
  not?: ModelWorkApplicationFilterInput | null,
  or?: Array< ModelWorkApplicationFilterInput | null > | null,
  owner?: ModelStringInput | null,
  phone?: ModelStringInput | null,
  position?: ModelStringInput | null,
  resumeKey?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
};

export type ModelWorkApplicationConnection = {
  __typename: "ModelWorkApplicationConnection",
  items:  Array<WorkApplication | null >,
  nextToken?: string | null,
};

export type AdminBulkUpdateUserRolesReturnType = {
  __typename: "AdminBulkUpdateUserRolesReturnType",
  failedCount: number,
  failures: string,
  successes: string,
  updatedCount: number,
};

export type AdminDeleteUserRoleAssignmentsReturnType = {
  __typename: "AdminDeleteUserRoleAssignmentsReturnType",
  deletedCount: number,
  failedCount: number,
  failures: string,
  successes: string,
};

export type AdminSyncCognitoUsersReturnType = {
  __typename: "AdminSyncCognitoUsersReturnType",
  createdCount: number,
  failedCount: number,
  failures:  Array<CognitoSyncFailure | null >,
  missingEmailCount: number,
  skippedCount: number,
  totalAssignmentsAfter: number,
  totalAssignmentsBefore: number,
  totalCognitoUsers: number,
};

export type CognitoSyncFailure = {
  __typename: "CognitoSyncFailure",
  email?: string | null,
  reason: string,
};

export type ModelCognitoSyncStateConditionInput = {
  and?: Array< ModelCognitoSyncStateConditionInput | null > | null,
  createdAt?: ModelStringInput | null,
  lastRunAt?: ModelStringInput | null,
  not?: ModelCognitoSyncStateConditionInput | null,
  or?: Array< ModelCognitoSyncStateConditionInput | null > | null,
  updatedAt?: ModelStringInput | null,
  updatedByEmail?: ModelStringInput | null,
  updatedBySub?: ModelStringInput | null,
};

export type CreateCognitoSyncStateInput = {
  id?: string | null,
  lastRunAt: string,
  updatedByEmail?: string | null,
  updatedBySub?: string | null,
};

export type ModelDashboardPreferenceConditionInput = {
  and?: Array< ModelDashboardPreferenceConditionInput | null > | null,
  createdAt?: ModelStringInput | null,
  favoriteFeatureKeys?: ModelStringInput | null,
  not?: ModelDashboardPreferenceConditionInput | null,
  or?: Array< ModelDashboardPreferenceConditionInput | null > | null,
  owner?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
};

export type CreateDashboardPreferenceInput = {
  favoriteFeatureKeys: Array< string | null >,
  owner: string,
};

export type ModelDeviceLoanEventConditionInput = {
  and?: Array< ModelDeviceLoanEventConditionInput | null > | null,
  changedAt?: ModelStringInput | null,
  changedByEmail?: ModelStringInput | null,
  changedByGroups?: ModelStringInput | null,
  changedByName?: ModelStringInput | null,
  changedBySub?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  newStatus?: ModelDeviceLoanStatusInput | null,
  not?: ModelDeviceLoanEventConditionInput | null,
  notes?: ModelStringInput | null,
  oldStatus?: ModelDeviceLoanStatusInput | null,
  or?: Array< ModelDeviceLoanEventConditionInput | null > | null,
  owner?: ModelStringInput | null,
  requestId?: ModelIDInput | null,
  updatedAt?: ModelStringInput | null,
};

export type CreateDeviceLoanEventInput = {
  changedAt: string,
  changedByEmail?: string | null,
  changedByGroups?: Array< string | null > | null,
  changedByName?: string | null,
  changedBySub: string,
  id?: string | null,
  newStatus: DeviceLoanStatus,
  notes?: string | null,
  oldStatus?: DeviceLoanStatus | null,
  owner: string,
  requestId: string,
};

export type ModelDeviceLoanRequestConditionInput = {
  and?: Array< ModelDeviceLoanRequestConditionInput | null > | null,
  borrowDate?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  email?: ModelStringInput | null,
  fullName?: ModelStringInput | null,
  grade?: ModelStringInput | null,
  not?: ModelDeviceLoanRequestConditionInput | null,
  notes?: ModelStringInput | null,
  or?: Array< ModelDeviceLoanRequestConditionInput | null > | null,
  owner?: ModelStringInput | null,
  reason?: ModelStringInput | null,
  requesterId?: ModelStringInput | null,
  returnDate?: ModelStringInput | null,
  status?: ModelDeviceLoanStatusInput | null,
  updatedAt?: ModelStringInput | null,
};

export type CreateDeviceLoanRequestInput = {
  borrowDate: string,
  email: string,
  fullName: string,
  grade?: string | null,
  id?: string | null,
  notes?: string | null,
  owner: string,
  reason: string,
  requesterId: string,
  returnDate: string,
  status: DeviceLoanStatus,
};

export type ModelReservationConditionInput = {
  and?: Array< ModelReservationConditionInput | null > | null,
  comments?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  email?: ModelStringInput | null,
  fullName?: ModelStringInput | null,
  not?: ModelReservationConditionInput | null,
  or?: Array< ModelReservationConditionInput | null > | null,
  owner?: ModelStringInput | null,
  phone?: ModelStringInput | null,
  requesterEmail?: ModelStringInput | null,
  requesterId?: ModelStringInput | null,
  requesterName?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
};

export type CreateReservationInput = {
  comments?: string | null,
  date: string,
  email?: string | null,
  fullName?: string | null,
  hour: number,
  owner?: string | null,
  phone?: string | null,
  requesterEmail?: string | null,
  requesterId?: string | null,
  requesterName?: string | null,
};

export type ModelStudentApplicationConditionInput = {
  address?: ModelStringInput | null,
  and?: Array< ModelStudentApplicationConditionInput | null > | null,
  city?: ModelStringInput | null,
  comments?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  currentSchool?: ModelStringInput | null,
  desiredGrade?: ModelStringInput | null,
  dob?: ModelStringInput | null,
  email?: ModelStringInput | null,
  fatherEmail?: ModelStringInput | null,
  fatherJob?: ModelStringInput | null,
  fatherName?: ModelStringInput | null,
  fatherPhone?: ModelStringInput | null,
  fullName?: ModelStringInput | null,
  gender?: ModelStringInput | null,
  livesWithParents?: ModelStringInput | null,
  livesWithParentsComment?: ModelStringInput | null,
  medicalNotes?: ModelStringInput | null,
  motherEmail?: ModelStringInput | null,
  motherJob?: ModelStringInput | null,
  motherName?: ModelStringInput | null,
  motherPhone?: ModelStringInput | null,
  motivation?: ModelStringInput | null,
  not?: ModelStudentApplicationConditionInput | null,
  or?: Array< ModelStudentApplicationConditionInput | null > | null,
  owner?: ModelStringInput | null,
  parentEmail?: ModelStringInput | null,
  parentName?: ModelStringInput | null,
  parentPhone?: ModelStringInput | null,
  phone?: ModelStringInput | null,
  socialAssistance?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
};

export type CreateStudentApplicationInput = {
  address?: string | null,
  city?: string | null,
  comments?: string | null,
  currentSchool?: string | null,
  desiredGrade: string,
  dob: string,
  email?: string | null,
  fatherEmail?: string | null,
  fatherJob?: string | null,
  fatherName?: string | null,
  fatherPhone?: string | null,
  fullName: string,
  gender?: string | null,
  id?: string | null,
  livesWithParents?: string | null,
  livesWithParentsComment?: string | null,
  medicalNotes?: string | null,
  motherEmail?: string | null,
  motherJob?: string | null,
  motherName?: string | null,
  motherPhone?: string | null,
  motivation: string,
  parentEmail?: string | null,
  parentName?: string | null,
  parentPhone?: string | null,
  phone?: string | null,
  socialAssistance?: string | null,
};

export type ModelUserProfileConditionInput = {
  and?: Array< ModelUserProfileConditionInput | null > | null,
  archivedAt?: ModelStringInput | null,
  completedAt?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  deactivatedAt?: ModelStringInput | null,
  displayName?: ModelStringInput | null,
  lastReviewedAt?: ModelStringInput | null,
  legalName?: ModelStringInput | null,
  not?: ModelUserProfileConditionInput | null,
  notes?: ModelStringInput | null,
  or?: Array< ModelUserProfileConditionInput | null > | null,
  phoneNumbers?: ModelStringInput | null,
  preferredName?: ModelStringInput | null,
  primaryEmail?: ModelStringInput | null,
  primaryEmailLower?: ModelStringInput | null,
  secondaryEmails?: ModelStringInput | null,
  status?: ModelProfileLifecycleStatusInput | null,
  tags?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  updatedByEmail?: ModelStringInput | null,
  updatedBySub?: ModelStringInput | null,
  userId?: ModelIDInput | null,
  userType?: ModelUserTypeInput | null,
};

export type CreateUserProfileInput = {
  archivedAt?: string | null,
  completedAt?: string | null,
  deactivatedAt?: string | null,
  displayName?: string | null,
  lastReviewedAt?: string | null,
  legalName?: string | null,
  notes?: string | null,
  phoneNumbers?: Array< string | null > | null,
  pk: string,
  preferredName?: string | null,
  primaryEmail?: string | null,
  primaryEmailLower?: string | null,
  secondaryEmails?: Array< string | null > | null,
  sk: string,
  status: ProfileLifecycleStatus,
  student?: StudentProfileInput | null,
  tags?: Array< string | null > | null,
  updatedByEmail?: string | null,
  updatedBySub?: string | null,
  userId: string,
  userType: UserType,
};

export type StudentProfileInput = {
  comments?: string | null,
  dateOfBirth?: string | null,
  fatherEmail?: string | null,
  fatherName?: string | null,
  fatherPhone?: string | null,
  fatherProfession?: string | null,
  fullName: string,
  healthNotes?: string | null,
  homeAddress?: string | null,
  homeCity?: string | null,
  livesWithBothParents?: boolean | null,
  motherEmail?: string | null,
  motherName?: string | null,
  motherPhone?: string | null,
  motherProfession?: string | null,
  receivesSocialAssistance?: boolean | null,
};

export type ModelUserRoleAssignmentConditionInput = {
  and?: Array< ModelUserRoleAssignmentConditionInput | null > | null,
  cognitoSub?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  not?: ModelUserRoleAssignmentConditionInput | null,
  notes?: ModelStringInput | null,
  or?: Array< ModelUserRoleAssignmentConditionInput | null > | null,
  primaryEmail?: ModelStringInput | null,
  primaryEmailLower?: ModelStringInput | null,
  roles?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
  updatedByEmail?: ModelStringInput | null,
  updatedBySub?: ModelStringInput | null,
  verifiedEmails?: ModelStringInput | null,
};

export type CreateUserRoleAssignmentInput = {
  cognitoSub?: string | null,
  id?: string | null,
  notes?: string | null,
  primaryEmail: string,
  primaryEmailLower: string,
  roles: Array< string | null >,
  updatedByEmail?: string | null,
  updatedBySub?: string | null,
  verifiedEmails?: Array< string | null > | null,
};

export type ModelWorkApplicationConditionInput = {
  and?: Array< ModelWorkApplicationConditionInput | null > | null,
  comments?: ModelStringInput | null,
  coverLetter?: ModelStringInput | null,
  createdAt?: ModelStringInput | null,
  email?: ModelStringInput | null,
  fullName?: ModelStringInput | null,
  not?: ModelWorkApplicationConditionInput | null,
  or?: Array< ModelWorkApplicationConditionInput | null > | null,
  owner?: ModelStringInput | null,
  phone?: ModelStringInput | null,
  position?: ModelStringInput | null,
  resumeKey?: ModelStringInput | null,
  updatedAt?: ModelStringInput | null,
};

export type CreateWorkApplicationInput = {
  comments?: string | null,
  coverLetter: string,
  email: string,
  fullName: string,
  id?: string | null,
  phone: string,
  position: string,
  resumeKey: string,
};

export type DeleteCognitoSyncStateInput = {
  id: string,
};

export type DeleteDashboardPreferenceInput = {
  owner: string,
};

export type DeleteDeviceLoanEventInput = {
  id: string,
};

export type DeleteDeviceLoanRequestInput = {
  id: string,
};

export type DeleteReservationInput = {
  date: string,
  hour: number,
};

export type DeleteStudentApplicationInput = {
  id: string,
};

export type DeleteUserProfileInput = {
  pk: string,
  sk: string,
};

export type DeleteUserRoleAssignmentInput = {
  id: string,
};

export type DeleteWorkApplicationInput = {
  id: string,
};

export type UpdateCognitoSyncStateInput = {
  id: string,
  lastRunAt?: string | null,
  updatedByEmail?: string | null,
  updatedBySub?: string | null,
};

export type UpdateDashboardPreferenceInput = {
  favoriteFeatureKeys?: Array< string | null > | null,
  owner: string,
};

export type UpdateDeviceLoanEventInput = {
  changedAt?: string | null,
  changedByEmail?: string | null,
  changedByGroups?: Array< string | null > | null,
  changedByName?: string | null,
  changedBySub?: string | null,
  id: string,
  newStatus?: DeviceLoanStatus | null,
  notes?: string | null,
  oldStatus?: DeviceLoanStatus | null,
  owner?: string | null,
  requestId?: string | null,
};

export type UpdateDeviceLoanRequestInput = {
  borrowDate?: string | null,
  email?: string | null,
  fullName?: string | null,
  grade?: string | null,
  id: string,
  notes?: string | null,
  owner?: string | null,
  reason?: string | null,
  requesterId?: string | null,
  returnDate?: string | null,
  status?: DeviceLoanStatus | null,
};

export type UpdateReservationInput = {
  comments?: string | null,
  date: string,
  email?: string | null,
  fullName?: string | null,
  hour: number,
  owner?: string | null,
  phone?: string | null,
  requesterEmail?: string | null,
  requesterId?: string | null,
  requesterName?: string | null,
};

export type UpdateStudentApplicationInput = {
  address?: string | null,
  city?: string | null,
  comments?: string | null,
  currentSchool?: string | null,
  desiredGrade?: string | null,
  dob?: string | null,
  email?: string | null,
  fatherEmail?: string | null,
  fatherJob?: string | null,
  fatherName?: string | null,
  fatherPhone?: string | null,
  fullName?: string | null,
  gender?: string | null,
  id: string,
  livesWithParents?: string | null,
  livesWithParentsComment?: string | null,
  medicalNotes?: string | null,
  motherEmail?: string | null,
  motherJob?: string | null,
  motherName?: string | null,
  motherPhone?: string | null,
  motivation?: string | null,
  parentEmail?: string | null,
  parentName?: string | null,
  parentPhone?: string | null,
  phone?: string | null,
  socialAssistance?: string | null,
};

export type UpdateUserProfileInput = {
  archivedAt?: string | null,
  completedAt?: string | null,
  deactivatedAt?: string | null,
  displayName?: string | null,
  lastReviewedAt?: string | null,
  legalName?: string | null,
  notes?: string | null,
  phoneNumbers?: Array< string | null > | null,
  pk: string,
  preferredName?: string | null,
  primaryEmail?: string | null,
  primaryEmailLower?: string | null,
  secondaryEmails?: Array< string | null > | null,
  sk: string,
  status?: ProfileLifecycleStatus | null,
  student?: StudentProfileInput | null,
  tags?: Array< string | null > | null,
  updatedByEmail?: string | null,
  updatedBySub?: string | null,
  userId?: string | null,
  userType?: UserType | null,
};

export type UpdateUserRoleAssignmentInput = {
  cognitoSub?: string | null,
  id: string,
  notes?: string | null,
  primaryEmail?: string | null,
  primaryEmailLower?: string | null,
  roles?: Array< string | null > | null,
  updatedByEmail?: string | null,
  updatedBySub?: string | null,
  verifiedEmails?: Array< string | null > | null,
};

export type UpdateWorkApplicationInput = {
  comments?: string | null,
  coverLetter?: string | null,
  email?: string | null,
  fullName?: string | null,
  id: string,
  phone?: string | null,
  position?: string | null,
  resumeKey?: string | null,
};

export type ModelSubscriptionCognitoSyncStateFilterInput = {
  and?: Array< ModelSubscriptionCognitoSyncStateFilterInput | null > | null,
  createdAt?: ModelSubscriptionStringInput | null,
  id?: ModelSubscriptionStringInput | null,
  lastRunAt?: ModelSubscriptionStringInput | null,
  or?: Array< ModelSubscriptionCognitoSyncStateFilterInput | null > | null,
  updatedAt?: ModelSubscriptionStringInput | null,
  updatedByEmail?: ModelSubscriptionStringInput | null,
  updatedBySub?: ModelSubscriptionStringInput | null,
};

export type ModelSubscriptionStringInput = {
  beginsWith?: string | null,
  between?: Array< string | null > | null,
  contains?: string | null,
  eq?: string | null,
  ge?: string | null,
  gt?: string | null,
  in?: Array< string | null > | null,
  le?: string | null,
  lt?: string | null,
  ne?: string | null,
  notContains?: string | null,
  notIn?: Array< string | null > | null,
};

export type ModelSubscriptionDashboardPreferenceFilterInput = {
  and?: Array< ModelSubscriptionDashboardPreferenceFilterInput | null > | null,
  createdAt?: ModelSubscriptionStringInput | null,
  favoriteFeatureKeys?: ModelSubscriptionStringInput | null,
  id?: ModelSubscriptionIDInput | null,
  or?: Array< ModelSubscriptionDashboardPreferenceFilterInput | null > | null,
  owner?: ModelStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
};

export type ModelSubscriptionIDInput = {
  beginsWith?: string | null,
  between?: Array< string | null > | null,
  contains?: string | null,
  eq?: string | null,
  ge?: string | null,
  gt?: string | null,
  in?: Array< string | null > | null,
  le?: string | null,
  lt?: string | null,
  ne?: string | null,
  notContains?: string | null,
  notIn?: Array< string | null > | null,
};

export type ModelSubscriptionDeviceLoanEventFilterInput = {
  and?: Array< ModelSubscriptionDeviceLoanEventFilterInput | null > | null,
  changedAt?: ModelSubscriptionStringInput | null,
  changedByEmail?: ModelSubscriptionStringInput | null,
  changedByGroups?: ModelSubscriptionStringInput | null,
  changedByName?: ModelSubscriptionStringInput | null,
  changedBySub?: ModelSubscriptionStringInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  id?: ModelSubscriptionIDInput | null,
  newStatus?: ModelSubscriptionStringInput | null,
  notes?: ModelSubscriptionStringInput | null,
  oldStatus?: ModelSubscriptionStringInput | null,
  or?: Array< ModelSubscriptionDeviceLoanEventFilterInput | null > | null,
  owner?: ModelStringInput | null,
  requestId?: ModelSubscriptionIDInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
};

export type ModelSubscriptionDeviceLoanRequestFilterInput = {
  and?: Array< ModelSubscriptionDeviceLoanRequestFilterInput | null > | null,
  borrowDate?: ModelSubscriptionStringInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  email?: ModelSubscriptionStringInput | null,
  fullName?: ModelSubscriptionStringInput | null,
  grade?: ModelSubscriptionStringInput | null,
  id?: ModelSubscriptionIDInput | null,
  notes?: ModelSubscriptionStringInput | null,
  or?: Array< ModelSubscriptionDeviceLoanRequestFilterInput | null > | null,
  owner?: ModelStringInput | null,
  reason?: ModelSubscriptionStringInput | null,
  requesterId?: ModelSubscriptionStringInput | null,
  returnDate?: ModelSubscriptionStringInput | null,
  status?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
};

export type ModelSubscriptionReservationFilterInput = {
  and?: Array< ModelSubscriptionReservationFilterInput | null > | null,
  comments?: ModelSubscriptionStringInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  date?: ModelSubscriptionStringInput | null,
  email?: ModelSubscriptionStringInput | null,
  fullName?: ModelSubscriptionStringInput | null,
  hour?: ModelSubscriptionIntInput | null,
  id?: ModelSubscriptionIDInput | null,
  or?: Array< ModelSubscriptionReservationFilterInput | null > | null,
  owner?: ModelStringInput | null,
  phone?: ModelSubscriptionStringInput | null,
  requesterEmail?: ModelSubscriptionStringInput | null,
  requesterId?: ModelSubscriptionStringInput | null,
  requesterName?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
};

export type ModelSubscriptionIntInput = {
  between?: Array< number | null > | null,
  eq?: number | null,
  ge?: number | null,
  gt?: number | null,
  in?: Array< number | null > | null,
  le?: number | null,
  lt?: number | null,
  ne?: number | null,
  notIn?: Array< number | null > | null,
};

export type ModelSubscriptionStudentApplicationFilterInput = {
  address?: ModelSubscriptionStringInput | null,
  and?: Array< ModelSubscriptionStudentApplicationFilterInput | null > | null,
  city?: ModelSubscriptionStringInput | null,
  comments?: ModelSubscriptionStringInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  currentSchool?: ModelSubscriptionStringInput | null,
  desiredGrade?: ModelSubscriptionStringInput | null,
  dob?: ModelSubscriptionStringInput | null,
  email?: ModelSubscriptionStringInput | null,
  fatherEmail?: ModelSubscriptionStringInput | null,
  fatherJob?: ModelSubscriptionStringInput | null,
  fatherName?: ModelSubscriptionStringInput | null,
  fatherPhone?: ModelSubscriptionStringInput | null,
  fullName?: ModelSubscriptionStringInput | null,
  gender?: ModelSubscriptionStringInput | null,
  id?: ModelSubscriptionIDInput | null,
  livesWithParents?: ModelSubscriptionStringInput | null,
  livesWithParentsComment?: ModelSubscriptionStringInput | null,
  medicalNotes?: ModelSubscriptionStringInput | null,
  motherEmail?: ModelSubscriptionStringInput | null,
  motherJob?: ModelSubscriptionStringInput | null,
  motherName?: ModelSubscriptionStringInput | null,
  motherPhone?: ModelSubscriptionStringInput | null,
  motivation?: ModelSubscriptionStringInput | null,
  or?: Array< ModelSubscriptionStudentApplicationFilterInput | null > | null,
  owner?: ModelStringInput | null,
  parentEmail?: ModelSubscriptionStringInput | null,
  parentName?: ModelSubscriptionStringInput | null,
  parentPhone?: ModelSubscriptionStringInput | null,
  phone?: ModelSubscriptionStringInput | null,
  socialAssistance?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
};

export type ModelSubscriptionUserProfileFilterInput = {
  and?: Array< ModelSubscriptionUserProfileFilterInput | null > | null,
  archivedAt?: ModelSubscriptionStringInput | null,
  completedAt?: ModelSubscriptionStringInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  deactivatedAt?: ModelSubscriptionStringInput | null,
  displayName?: ModelSubscriptionStringInput | null,
  id?: ModelSubscriptionIDInput | null,
  lastReviewedAt?: ModelSubscriptionStringInput | null,
  legalName?: ModelSubscriptionStringInput | null,
  notes?: ModelSubscriptionStringInput | null,
  or?: Array< ModelSubscriptionUserProfileFilterInput | null > | null,
  phoneNumbers?: ModelSubscriptionStringInput | null,
  pk?: ModelSubscriptionStringInput | null,
  preferredName?: ModelSubscriptionStringInput | null,
  primaryEmail?: ModelSubscriptionStringInput | null,
  primaryEmailLower?: ModelSubscriptionStringInput | null,
  secondaryEmails?: ModelSubscriptionStringInput | null,
  sk?: ModelSubscriptionStringInput | null,
  status?: ModelSubscriptionStringInput | null,
  tags?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
  updatedByEmail?: ModelSubscriptionStringInput | null,
  updatedBySub?: ModelSubscriptionStringInput | null,
  userId?: ModelSubscriptionIDInput | null,
  userType?: ModelSubscriptionStringInput | null,
};

export type ModelSubscriptionUserRoleAssignmentFilterInput = {
  and?: Array< ModelSubscriptionUserRoleAssignmentFilterInput | null > | null,
  cognitoSub?: ModelSubscriptionStringInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  id?: ModelSubscriptionIDInput | null,
  notes?: ModelSubscriptionStringInput | null,
  or?: Array< ModelSubscriptionUserRoleAssignmentFilterInput | null > | null,
  primaryEmail?: ModelSubscriptionStringInput | null,
  primaryEmailLower?: ModelSubscriptionStringInput | null,
  roles?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
  updatedByEmail?: ModelSubscriptionStringInput | null,
  updatedBySub?: ModelSubscriptionStringInput | null,
  verifiedEmails?: ModelSubscriptionStringInput | null,
};

export type ModelSubscriptionWorkApplicationFilterInput = {
  and?: Array< ModelSubscriptionWorkApplicationFilterInput | null > | null,
  comments?: ModelSubscriptionStringInput | null,
  coverLetter?: ModelSubscriptionStringInput | null,
  createdAt?: ModelSubscriptionStringInput | null,
  email?: ModelSubscriptionStringInput | null,
  fullName?: ModelSubscriptionStringInput | null,
  id?: ModelSubscriptionIDInput | null,
  or?: Array< ModelSubscriptionWorkApplicationFilterInput | null > | null,
  owner?: ModelStringInput | null,
  phone?: ModelSubscriptionStringInput | null,
  position?: ModelSubscriptionStringInput | null,
  resumeKey?: ModelSubscriptionStringInput | null,
  updatedAt?: ModelSubscriptionStringInput | null,
};

export type GetCognitoSyncStateQueryVariables = {
  id: string,
};

export type GetCognitoSyncStateQuery = {
  getCognitoSyncState?:  {
    __typename: "CognitoSyncState",
    createdAt: string,
    id: string,
    lastRunAt: string,
    updatedAt: string,
    updatedByEmail?: string | null,
    updatedBySub?: string | null,
  } | null,
};

export type GetDashboardPreferenceQueryVariables = {
  owner: string,
};

export type GetDashboardPreferenceQuery = {
  getDashboardPreference?:  {
    __typename: "DashboardPreference",
    createdAt: string,
    favoriteFeatureKeys: Array< string | null >,
    owner: string,
    updatedAt: string,
  } | null,
};

export type GetDeviceLoanEventQueryVariables = {
  id: string,
};

export type GetDeviceLoanEventQuery = {
  getDeviceLoanEvent?:  {
    __typename: "DeviceLoanEvent",
    changedAt: string,
    changedByEmail?: string | null,
    changedByGroups?: Array< string | null > | null,
    changedByName?: string | null,
    changedBySub: string,
    createdAt: string,
    id: string,
    newStatus: DeviceLoanStatus,
    notes?: string | null,
    oldStatus?: DeviceLoanStatus | null,
    owner: string,
    requestId: string,
    updatedAt: string,
  } | null,
};

export type GetDeviceLoanRequestQueryVariables = {
  id: string,
};

export type GetDeviceLoanRequestQuery = {
  getDeviceLoanRequest?:  {
    __typename: "DeviceLoanRequest",
    borrowDate: string,
    createdAt: string,
    email: string,
    fullName: string,
    grade?: string | null,
    id: string,
    notes?: string | null,
    owner: string,
    reason: string,
    requesterId: string,
    returnDate: string,
    status: DeviceLoanStatus,
    updatedAt: string,
  } | null,
};

export type GetReservationQueryVariables = {
  date: string,
  hour: number,
};

export type GetReservationQuery = {
  getReservation?:  {
    __typename: "Reservation",
    comments?: string | null,
    createdAt: string,
    date: string,
    email?: string | null,
    fullName?: string | null,
    hour: number,
    owner?: string | null,
    phone?: string | null,
    requesterEmail?: string | null,
    requesterId?: string | null,
    requesterName?: string | null,
    updatedAt: string,
  } | null,
};

export type GetStudentApplicationQueryVariables = {
  id: string,
};

export type GetStudentApplicationQuery = {
  getStudentApplication?:  {
    __typename: "StudentApplication",
    address?: string | null,
    city?: string | null,
    comments?: string | null,
    createdAt: string,
    currentSchool?: string | null,
    desiredGrade: string,
    dob: string,
    email?: string | null,
    fatherEmail?: string | null,
    fatherJob?: string | null,
    fatherName?: string | null,
    fatherPhone?: string | null,
    fullName: string,
    gender?: string | null,
    id: string,
    livesWithParents?: string | null,
    livesWithParentsComment?: string | null,
    medicalNotes?: string | null,
    motherEmail?: string | null,
    motherJob?: string | null,
    motherName?: string | null,
    motherPhone?: string | null,
    motivation: string,
    owner?: string | null,
    parentEmail?: string | null,
    parentName?: string | null,
    parentPhone?: string | null,
    phone?: string | null,
    socialAssistance?: string | null,
    updatedAt: string,
  } | null,
};

export type GetUserProfileQueryVariables = {
  pk: string,
  sk: string,
};

export type GetUserProfileQuery = {
  getUserProfile?:  {
    __typename: "UserProfile",
    archivedAt?: string | null,
    completedAt?: string | null,
    createdAt: string,
    deactivatedAt?: string | null,
    displayName?: string | null,
    lastReviewedAt?: string | null,
    legalName?: string | null,
    notes?: string | null,
    phoneNumbers?: Array< string | null > | null,
    pk: string,
    preferredName?: string | null,
    primaryEmail?: string | null,
    primaryEmailLower?: string | null,
    secondaryEmails?: Array< string | null > | null,
    sk: string,
    status: ProfileLifecycleStatus,
    student?:  {
      __typename: "StudentProfile",
      comments?: string | null,
      dateOfBirth?: string | null,
      fatherEmail?: string | null,
      fatherName?: string | null,
      fatherPhone?: string | null,
      fatherProfession?: string | null,
      fullName: string,
      healthNotes?: string | null,
      homeAddress?: string | null,
      homeCity?: string | null,
      livesWithBothParents?: boolean | null,
      motherEmail?: string | null,
      motherName?: string | null,
      motherPhone?: string | null,
      motherProfession?: string | null,
      receivesSocialAssistance?: boolean | null,
    } | null,
    tags?: Array< string | null > | null,
    updatedAt: string,
    updatedByEmail?: string | null,
    updatedBySub?: string | null,
    userId: string,
    userType: UserType,
  } | null,
};

export type GetUserProfileByUserIdQueryVariables = {
  filter?: ModelUserProfileFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
  userId: string,
};

export type GetUserProfileByUserIdQuery = {
  getUserProfileByUserId?:  {
    __typename: "ModelUserProfileConnection",
    items:  Array< {
      __typename: "UserProfile",
      archivedAt?: string | null,
      completedAt?: string | null,
      createdAt: string,
      deactivatedAt?: string | null,
      displayName?: string | null,
      lastReviewedAt?: string | null,
      legalName?: string | null,
      notes?: string | null,
      phoneNumbers?: Array< string | null > | null,
      pk: string,
      preferredName?: string | null,
      primaryEmail?: string | null,
      primaryEmailLower?: string | null,
      secondaryEmails?: Array< string | null > | null,
      sk: string,
      status: ProfileLifecycleStatus,
      tags?: Array< string | null > | null,
      updatedAt: string,
      updatedByEmail?: string | null,
      updatedBySub?: string | null,
      userId: string,
      userType: UserType,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type GetUserRoleAssignmentQueryVariables = {
  id: string,
};

export type GetUserRoleAssignmentQuery = {
  getUserRoleAssignment?:  {
    __typename: "UserRoleAssignment",
    cognitoSub?: string | null,
    createdAt: string,
    id: string,
    notes?: string | null,
    primaryEmail: string,
    primaryEmailLower: string,
    roles: Array< string | null >,
    updatedAt: string,
    updatedByEmail?: string | null,
    updatedBySub?: string | null,
    verifiedEmails?: Array< string | null > | null,
  } | null,
};

export type GetWorkApplicationQueryVariables = {
  id: string,
};

export type GetWorkApplicationQuery = {
  getWorkApplication?:  {
    __typename: "WorkApplication",
    comments?: string | null,
    coverLetter: string,
    createdAt: string,
    email: string,
    fullName: string,
    id: string,
    owner?: string | null,
    phone: string,
    position: string,
    resumeKey: string,
    updatedAt: string,
  } | null,
};

export type ListCognitoSyncStatesQueryVariables = {
  filter?: ModelCognitoSyncStateFilterInput | null,
  id?: string | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
};

export type ListCognitoSyncStatesQuery = {
  listCognitoSyncStates?:  {
    __typename: "ModelCognitoSyncStateConnection",
    items:  Array< {
      __typename: "CognitoSyncState",
      createdAt: string,
      id: string,
      lastRunAt: string,
      updatedAt: string,
      updatedByEmail?: string | null,
      updatedBySub?: string | null,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListDashboardPreferencesQueryVariables = {
  filter?: ModelDashboardPreferenceFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  owner?: string | null,
  sortDirection?: ModelSortDirection | null,
};

export type ListDashboardPreferencesQuery = {
  listDashboardPreferences?:  {
    __typename: "ModelDashboardPreferenceConnection",
    items:  Array< {
      __typename: "DashboardPreference",
      createdAt: string,
      favoriteFeatureKeys: Array< string | null >,
      owner: string,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListDeviceLoanEventsQueryVariables = {
  filter?: ModelDeviceLoanEventFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type ListDeviceLoanEventsQuery = {
  listDeviceLoanEvents?:  {
    __typename: "ModelDeviceLoanEventConnection",
    items:  Array< {
      __typename: "DeviceLoanEvent",
      changedAt: string,
      changedByEmail?: string | null,
      changedByGroups?: Array< string | null > | null,
      changedByName?: string | null,
      changedBySub: string,
      createdAt: string,
      id: string,
      newStatus: DeviceLoanStatus,
      notes?: string | null,
      oldStatus?: DeviceLoanStatus | null,
      owner: string,
      requestId: string,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListDeviceLoanRequestsQueryVariables = {
  filter?: ModelDeviceLoanRequestFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type ListDeviceLoanRequestsQuery = {
  listDeviceLoanRequests?:  {
    __typename: "ModelDeviceLoanRequestConnection",
    items:  Array< {
      __typename: "DeviceLoanRequest",
      borrowDate: string,
      createdAt: string,
      email: string,
      fullName: string,
      grade?: string | null,
      id: string,
      notes?: string | null,
      owner: string,
      reason: string,
      requesterId: string,
      returnDate: string,
      status: DeviceLoanStatus,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListReservationsQueryVariables = {
  date?: string | null,
  filter?: ModelReservationFilterInput | null,
  hour?: ModelIntKeyConditionInput | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
};

export type ListReservationsQuery = {
  listReservations?:  {
    __typename: "ModelReservationConnection",
    items:  Array< {
      __typename: "Reservation",
      comments?: string | null,
      createdAt: string,
      date: string,
      email?: string | null,
      fullName?: string | null,
      hour: number,
      owner?: string | null,
      phone?: string | null,
      requesterEmail?: string | null,
      requesterId?: string | null,
      requesterName?: string | null,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListReservedHoursQueryVariables = {
  date: string,
};

export type ListReservedHoursQuery = {
  listReservedHours: Array< number | null >,
};

export type ListStudentApplicationsQueryVariables = {
  filter?: ModelStudentApplicationFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type ListStudentApplicationsQuery = {
  listStudentApplications?:  {
    __typename: "ModelStudentApplicationConnection",
    items:  Array< {
      __typename: "StudentApplication",
      address?: string | null,
      city?: string | null,
      comments?: string | null,
      createdAt: string,
      currentSchool?: string | null,
      desiredGrade: string,
      dob: string,
      email?: string | null,
      fatherEmail?: string | null,
      fatherJob?: string | null,
      fatherName?: string | null,
      fatherPhone?: string | null,
      fullName: string,
      gender?: string | null,
      id: string,
      livesWithParents?: string | null,
      livesWithParentsComment?: string | null,
      medicalNotes?: string | null,
      motherEmail?: string | null,
      motherJob?: string | null,
      motherName?: string | null,
      motherPhone?: string | null,
      motivation: string,
      owner?: string | null,
      parentEmail?: string | null,
      parentName?: string | null,
      parentPhone?: string | null,
      phone?: string | null,
      socialAssistance?: string | null,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListUserProfilesQueryVariables = {
  filter?: ModelUserProfileFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  pk?: string | null,
  sk?: ModelStringKeyConditionInput | null,
  sortDirection?: ModelSortDirection | null,
};

export type ListUserProfilesQuery = {
  listUserProfiles?:  {
    __typename: "ModelUserProfileConnection",
    items:  Array< {
      __typename: "UserProfile",
      archivedAt?: string | null,
      completedAt?: string | null,
      createdAt: string,
      deactivatedAt?: string | null,
      displayName?: string | null,
      lastReviewedAt?: string | null,
      legalName?: string | null,
      notes?: string | null,
      phoneNumbers?: Array< string | null > | null,
      pk: string,
      preferredName?: string | null,
      primaryEmail?: string | null,
      primaryEmailLower?: string | null,
      secondaryEmails?: Array< string | null > | null,
      sk: string,
      status: ProfileLifecycleStatus,
      tags?: Array< string | null > | null,
      updatedAt: string,
      updatedByEmail?: string | null,
      updatedBySub?: string | null,
      userId: string,
      userType: UserType,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListUserProfilesByPrimaryEmailLowerQueryVariables = {
  filter?: ModelUserProfileFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  primaryEmailLower: string,
  sortDirection?: ModelSortDirection | null,
};

export type ListUserProfilesByPrimaryEmailLowerQuery = {
  listUserProfilesByPrimaryEmailLower?:  {
    __typename: "ModelUserProfileConnection",
    items:  Array< {
      __typename: "UserProfile",
      archivedAt?: string | null,
      completedAt?: string | null,
      createdAt: string,
      deactivatedAt?: string | null,
      displayName?: string | null,
      lastReviewedAt?: string | null,
      legalName?: string | null,
      notes?: string | null,
      phoneNumbers?: Array< string | null > | null,
      pk: string,
      preferredName?: string | null,
      primaryEmail?: string | null,
      primaryEmailLower?: string | null,
      secondaryEmails?: Array< string | null > | null,
      sk: string,
      status: ProfileLifecycleStatus,
      tags?: Array< string | null > | null,
      updatedAt: string,
      updatedByEmail?: string | null,
      updatedBySub?: string | null,
      userId: string,
      userType: UserType,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListUserProfilesByUserTypeQueryVariables = {
  filter?: ModelUserProfileFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
  userType: UserType,
};

export type ListUserProfilesByUserTypeQuery = {
  listUserProfilesByUserType?:  {
    __typename: "ModelUserProfileConnection",
    items:  Array< {
      __typename: "UserProfile",
      archivedAt?: string | null,
      completedAt?: string | null,
      createdAt: string,
      deactivatedAt?: string | null,
      displayName?: string | null,
      lastReviewedAt?: string | null,
      legalName?: string | null,
      notes?: string | null,
      phoneNumbers?: Array< string | null > | null,
      pk: string,
      preferredName?: string | null,
      primaryEmail?: string | null,
      primaryEmailLower?: string | null,
      secondaryEmails?: Array< string | null > | null,
      sk: string,
      status: ProfileLifecycleStatus,
      tags?: Array< string | null > | null,
      updatedAt: string,
      updatedByEmail?: string | null,
      updatedBySub?: string | null,
      userId: string,
      userType: UserType,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListUserRoleAssignmentsQueryVariables = {
  filter?: ModelUserRoleAssignmentFilterInput | null,
  id?: string | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
};

export type ListUserRoleAssignmentsQuery = {
  listUserRoleAssignments?:  {
    __typename: "ModelUserRoleAssignmentConnection",
    items:  Array< {
      __typename: "UserRoleAssignment",
      cognitoSub?: string | null,
      createdAt: string,
      id: string,
      notes?: string | null,
      primaryEmail: string,
      primaryEmailLower: string,
      roles: Array< string | null >,
      updatedAt: string,
      updatedByEmail?: string | null,
      updatedBySub?: string | null,
      verifiedEmails?: Array< string | null > | null,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListUserRoleAssignmentsByCognitoSubQueryVariables = {
  cognitoSub: string,
  filter?: ModelUserRoleAssignmentFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  sortDirection?: ModelSortDirection | null,
};

export type ListUserRoleAssignmentsByCognitoSubQuery = {
  listUserRoleAssignmentsByCognitoSub?:  {
    __typename: "ModelUserRoleAssignmentConnection",
    items:  Array< {
      __typename: "UserRoleAssignment",
      cognitoSub?: string | null,
      createdAt: string,
      id: string,
      notes?: string | null,
      primaryEmail: string,
      primaryEmailLower: string,
      roles: Array< string | null >,
      updatedAt: string,
      updatedByEmail?: string | null,
      updatedBySub?: string | null,
      verifiedEmails?: Array< string | null > | null,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListUserRoleAssignmentsByPrimaryEmailLowerQueryVariables = {
  filter?: ModelUserRoleAssignmentFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
  primaryEmailLower: string,
  sortDirection?: ModelSortDirection | null,
};

export type ListUserRoleAssignmentsByPrimaryEmailLowerQuery = {
  listUserRoleAssignmentsByPrimaryEmailLower?:  {
    __typename: "ModelUserRoleAssignmentConnection",
    items:  Array< {
      __typename: "UserRoleAssignment",
      cognitoSub?: string | null,
      createdAt: string,
      id: string,
      notes?: string | null,
      primaryEmail: string,
      primaryEmailLower: string,
      roles: Array< string | null >,
      updatedAt: string,
      updatedByEmail?: string | null,
      updatedBySub?: string | null,
      verifiedEmails?: Array< string | null > | null,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type ListWorkApplicationsQueryVariables = {
  filter?: ModelWorkApplicationFilterInput | null,
  limit?: number | null,
  nextToken?: string | null,
};

export type ListWorkApplicationsQuery = {
  listWorkApplications?:  {
    __typename: "ModelWorkApplicationConnection",
    items:  Array< {
      __typename: "WorkApplication",
      comments?: string | null,
      coverLetter: string,
      createdAt: string,
      email: string,
      fullName: string,
      id: string,
      owner?: string | null,
      phone: string,
      position: string,
      resumeKey: string,
      updatedAt: string,
    } | null >,
    nextToken?: string | null,
  } | null,
};

export type AdminBulkUpdateUserRolesMutationVariables = {
  action: string,
  primaryEmails: Array< string | null >,
  roles: Array< string | null >,
};

export type AdminBulkUpdateUserRolesMutation = {
  adminBulkUpdateUserRoles?:  {
    __typename: "AdminBulkUpdateUserRolesReturnType",
    failedCount: number,
    failures: string,
    successes: string,
    updatedCount: number,
  } | null,
};

export type AdminDeleteUserRoleAssignmentsMutationVariables = {
  primaryEmails: Array< string | null >,
};

export type AdminDeleteUserRoleAssignmentsMutation = {
  adminDeleteUserRoleAssignments?:  {
    __typename: "AdminDeleteUserRoleAssignmentsReturnType",
    deletedCount: number,
    failedCount: number,
    failures: string,
    successes: string,
  } | null,
};

export type AdminImportUserAccountsMutationVariables = {
  csv: string,
};

export type AdminImportUserAccountsMutation = {
  adminImportUserAccounts: string,
};

export type AdminSyncCognitoUsersMutationVariables = {
};

export type AdminSyncCognitoUsersMutation = {
  adminSyncCognitoUsers?:  {
    __typename: "AdminSyncCognitoUsersReturnType",
    createdCount: number,
    failedCount: number,
    failures:  Array< {
      __typename: "CognitoSyncFailure",
      email?: string | null,
      reason: string,
    } | null >,
    missingEmailCount: number,
    skippedCount: number,
    totalAssignmentsAfter: number,
    totalAssignmentsBefore: number,
    totalCognitoUsers: number,
  } | null,
};

export type AdminUpsertUserRoleAssignmentMutationVariables = {
  cognitoSub?: string | null,
  notes?: string | null,
  primaryEmail: string,
  roles: Array< string | null >,
  userId?: string | null,
  verifiedEmails?: Array< string | null > | null,
};

export type AdminUpsertUserRoleAssignmentMutation = {
  adminUpsertUserRoleAssignment?:  {
    __typename: "UserRoleAssignment",
    cognitoSub?: string | null,
    createdAt: string,
    id: string,
    notes?: string | null,
    primaryEmail: string,
    primaryEmailLower: string,
    roles: Array< string | null >,
    updatedAt: string,
    updatedByEmail?: string | null,
    updatedBySub?: string | null,
    verifiedEmails?: Array< string | null > | null,
  } | null,
};

export type CreateCognitoSyncStateMutationVariables = {
  condition?: ModelCognitoSyncStateConditionInput | null,
  input: CreateCognitoSyncStateInput,
};

export type CreateCognitoSyncStateMutation = {
  createCognitoSyncState?:  {
    __typename: "CognitoSyncState",
    createdAt: string,
    id: string,
    lastRunAt: string,
    updatedAt: string,
    updatedByEmail?: string | null,
    updatedBySub?: string | null,
  } | null,
};

export type CreateDashboardPreferenceMutationVariables = {
  condition?: ModelDashboardPreferenceConditionInput | null,
  input: CreateDashboardPreferenceInput,
};

export type CreateDashboardPreferenceMutation = {
  createDashboardPreference?:  {
    __typename: "DashboardPreference",
    createdAt: string,
    favoriteFeatureKeys: Array< string | null >,
    owner: string,
    updatedAt: string,
  } | null,
};

export type CreateDeviceLoanAndNotifyMutationVariables = {
  borrowDate: string,
  email?: string | null,
  fullName?: string | null,
  grade?: string | null,
  reason: string,
  returnDate: string,
};

export type CreateDeviceLoanAndNotifyMutation = {
  createDeviceLoanAndNotify?:  {
    __typename: "DeviceLoanRequest",
    borrowDate: string,
    createdAt: string,
    email: string,
    fullName: string,
    grade?: string | null,
    id: string,
    notes?: string | null,
    owner: string,
    reason: string,
    requesterId: string,
    returnDate: string,
    status: DeviceLoanStatus,
    updatedAt: string,
  } | null,
};

export type CreateDeviceLoanEventMutationVariables = {
  condition?: ModelDeviceLoanEventConditionInput | null,
  input: CreateDeviceLoanEventInput,
};

export type CreateDeviceLoanEventMutation = {
  createDeviceLoanEvent?:  {
    __typename: "DeviceLoanEvent",
    changedAt: string,
    changedByEmail?: string | null,
    changedByGroups?: Array< string | null > | null,
    changedByName?: string | null,
    changedBySub: string,
    createdAt: string,
    id: string,
    newStatus: DeviceLoanStatus,
    notes?: string | null,
    oldStatus?: DeviceLoanStatus | null,
    owner: string,
    requestId: string,
    updatedAt: string,
  } | null,
};

export type CreateDeviceLoanRequestMutationVariables = {
  condition?: ModelDeviceLoanRequestConditionInput | null,
  input: CreateDeviceLoanRequestInput,
};

export type CreateDeviceLoanRequestMutation = {
  createDeviceLoanRequest?:  {
    __typename: "DeviceLoanRequest",
    borrowDate: string,
    createdAt: string,
    email: string,
    fullName: string,
    grade?: string | null,
    id: string,
    notes?: string | null,
    owner: string,
    reason: string,
    requesterId: string,
    returnDate: string,
    status: DeviceLoanStatus,
    updatedAt: string,
  } | null,
};

export type CreateReservationMutationVariables = {
  condition?: ModelReservationConditionInput | null,
  input: CreateReservationInput,
};

export type CreateReservationMutation = {
  createReservation?:  {
    __typename: "Reservation",
    comments?: string | null,
    createdAt: string,
    date: string,
    email?: string | null,
    fullName?: string | null,
    hour: number,
    owner?: string | null,
    phone?: string | null,
    requesterEmail?: string | null,
    requesterId?: string | null,
    requesterName?: string | null,
    updatedAt: string,
  } | null,
};

export type CreateReservationValidatedMutationVariables = {
  comments?: string | null,
  date: string,
  email: string,
  fullName: string,
  hour: number,
  phone?: string | null,
};

export type CreateReservationValidatedMutation = {
  createReservationValidated: number,
};

export type CreateStudentApplicationMutationVariables = {
  condition?: ModelStudentApplicationConditionInput | null,
  input: CreateStudentApplicationInput,
};

export type CreateStudentApplicationMutation = {
  createStudentApplication?:  {
    __typename: "StudentApplication",
    address?: string | null,
    city?: string | null,
    comments?: string | null,
    createdAt: string,
    currentSchool?: string | null,
    desiredGrade: string,
    dob: string,
    email?: string | null,
    fatherEmail?: string | null,
    fatherJob?: string | null,
    fatherName?: string | null,
    fatherPhone?: string | null,
    fullName: string,
    gender?: string | null,
    id: string,
    livesWithParents?: string | null,
    livesWithParentsComment?: string | null,
    medicalNotes?: string | null,
    motherEmail?: string | null,
    motherJob?: string | null,
    motherName?: string | null,
    motherPhone?: string | null,
    motivation: string,
    owner?: string | null,
    parentEmail?: string | null,
    parentName?: string | null,
    parentPhone?: string | null,
    phone?: string | null,
    socialAssistance?: string | null,
    updatedAt: string,
  } | null,
};

export type CreateUserProfileMutationVariables = {
  condition?: ModelUserProfileConditionInput | null,
  input: CreateUserProfileInput,
};

export type CreateUserProfileMutation = {
  createUserProfile?:  {
    __typename: "UserProfile",
    archivedAt?: string | null,
    completedAt?: string | null,
    createdAt: string,
    deactivatedAt?: string | null,
    displayName?: string | null,
    lastReviewedAt?: string | null,
    legalName?: string | null,
    notes?: string | null,
    phoneNumbers?: Array< string | null > | null,
    pk: string,
    preferredName?: string | null,
    primaryEmail?: string | null,
    primaryEmailLower?: string | null,
    secondaryEmails?: Array< string | null > | null,
    sk: string,
    status: ProfileLifecycleStatus,
    student?:  {
      __typename: "StudentProfile",
      comments?: string | null,
      dateOfBirth?: string | null,
      fatherEmail?: string | null,
      fatherName?: string | null,
      fatherPhone?: string | null,
      fatherProfession?: string | null,
      fullName: string,
      healthNotes?: string | null,
      homeAddress?: string | null,
      homeCity?: string | null,
      livesWithBothParents?: boolean | null,
      motherEmail?: string | null,
      motherName?: string | null,
      motherPhone?: string | null,
      motherProfession?: string | null,
      receivesSocialAssistance?: boolean | null,
    } | null,
    tags?: Array< string | null > | null,
    updatedAt: string,
    updatedByEmail?: string | null,
    updatedBySub?: string | null,
    userId: string,
    userType: UserType,
  } | null,
};

export type CreateUserRoleAssignmentMutationVariables = {
  condition?: ModelUserRoleAssignmentConditionInput | null,
  input: CreateUserRoleAssignmentInput,
};

export type CreateUserRoleAssignmentMutation = {
  createUserRoleAssignment?:  {
    __typename: "UserRoleAssignment",
    cognitoSub?: string | null,
    createdAt: string,
    id: string,
    notes?: string | null,
    primaryEmail: string,
    primaryEmailLower: string,
    roles: Array< string | null >,
    updatedAt: string,
    updatedByEmail?: string | null,
    updatedBySub?: string | null,
    verifiedEmails?: Array< string | null > | null,
  } | null,
};

export type CreateWorkApplicationMutationVariables = {
  condition?: ModelWorkApplicationConditionInput | null,
  input: CreateWorkApplicationInput,
};

export type CreateWorkApplicationMutation = {
  createWorkApplication?:  {
    __typename: "WorkApplication",
    comments?: string | null,
    coverLetter: string,
    createdAt: string,
    email: string,
    fullName: string,
    id: string,
    owner?: string | null,
    phone: string,
    position: string,
    resumeKey: string,
    updatedAt: string,
  } | null,
};

export type DeleteCognitoSyncStateMutationVariables = {
  condition?: ModelCognitoSyncStateConditionInput | null,
  input: DeleteCognitoSyncStateInput,
};

export type DeleteCognitoSyncStateMutation = {
  deleteCognitoSyncState?:  {
    __typename: "CognitoSyncState",
    createdAt: string,
    id: string,
    lastRunAt: string,
    updatedAt: string,
    updatedByEmail?: string | null,
    updatedBySub?: string | null,
  } | null,
};

export type DeleteDashboardPreferenceMutationVariables = {
  condition?: ModelDashboardPreferenceConditionInput | null,
  input: DeleteDashboardPreferenceInput,
};

export type DeleteDashboardPreferenceMutation = {
  deleteDashboardPreference?:  {
    __typename: "DashboardPreference",
    createdAt: string,
    favoriteFeatureKeys: Array< string | null >,
    owner: string,
    updatedAt: string,
  } | null,
};

export type DeleteDeviceLoanEventMutationVariables = {
  condition?: ModelDeviceLoanEventConditionInput | null,
  input: DeleteDeviceLoanEventInput,
};

export type DeleteDeviceLoanEventMutation = {
  deleteDeviceLoanEvent?:  {
    __typename: "DeviceLoanEvent",
    changedAt: string,
    changedByEmail?: string | null,
    changedByGroups?: Array< string | null > | null,
    changedByName?: string | null,
    changedBySub: string,
    createdAt: string,
    id: string,
    newStatus: DeviceLoanStatus,
    notes?: string | null,
    oldStatus?: DeviceLoanStatus | null,
    owner: string,
    requestId: string,
    updatedAt: string,
  } | null,
};

export type DeleteDeviceLoanRequestMutationVariables = {
  condition?: ModelDeviceLoanRequestConditionInput | null,
  input: DeleteDeviceLoanRequestInput,
};

export type DeleteDeviceLoanRequestMutation = {
  deleteDeviceLoanRequest?:  {
    __typename: "DeviceLoanRequest",
    borrowDate: string,
    createdAt: string,
    email: string,
    fullName: string,
    grade?: string | null,
    id: string,
    notes?: string | null,
    owner: string,
    reason: string,
    requesterId: string,
    returnDate: string,
    status: DeviceLoanStatus,
    updatedAt: string,
  } | null,
};

export type DeleteReservationMutationVariables = {
  condition?: ModelReservationConditionInput | null,
  input: DeleteReservationInput,
};

export type DeleteReservationMutation = {
  deleteReservation?:  {
    __typename: "Reservation",
    comments?: string | null,
    createdAt: string,
    date: string,
    email?: string | null,
    fullName?: string | null,
    hour: number,
    owner?: string | null,
    phone?: string | null,
    requesterEmail?: string | null,
    requesterId?: string | null,
    requesterName?: string | null,
    updatedAt: string,
  } | null,
};

export type DeleteStudentApplicationMutationVariables = {
  condition?: ModelStudentApplicationConditionInput | null,
  input: DeleteStudentApplicationInput,
};

export type DeleteStudentApplicationMutation = {
  deleteStudentApplication?:  {
    __typename: "StudentApplication",
    address?: string | null,
    city?: string | null,
    comments?: string | null,
    createdAt: string,
    currentSchool?: string | null,
    desiredGrade: string,
    dob: string,
    email?: string | null,
    fatherEmail?: string | null,
    fatherJob?: string | null,
    fatherName?: string | null,
    fatherPhone?: string | null,
    fullName: string,
    gender?: string | null,
    id: string,
    livesWithParents?: string | null,
    livesWithParentsComment?: string | null,
    medicalNotes?: string | null,
    motherEmail?: string | null,
    motherJob?: string | null,
    motherName?: string | null,
    motherPhone?: string | null,
    motivation: string,
    owner?: string | null,
    parentEmail?: string | null,
    parentName?: string | null,
    parentPhone?: string | null,
    phone?: string | null,
    socialAssistance?: string | null,
    updatedAt: string,
  } | null,
};

export type DeleteUserProfileMutationVariables = {
  condition?: ModelUserProfileConditionInput | null,
  input: DeleteUserProfileInput,
};

export type DeleteUserProfileMutation = {
  deleteUserProfile?:  {
    __typename: "UserProfile",
    archivedAt?: string | null,
    completedAt?: string | null,
    createdAt: string,
    deactivatedAt?: string | null,
    displayName?: string | null,
    lastReviewedAt?: string | null,
    legalName?: string | null,
    notes?: string | null,
    phoneNumbers?: Array< string | null > | null,
    pk: string,
    preferredName?: string | null,
    primaryEmail?: string | null,
    primaryEmailLower?: string | null,
    secondaryEmails?: Array< string | null > | null,
    sk: string,
    status: ProfileLifecycleStatus,
    student?:  {
      __typename: "StudentProfile",
      comments?: string | null,
      dateOfBirth?: string | null,
      fatherEmail?: string | null,
      fatherName?: string | null,
      fatherPhone?: string | null,
      fatherProfession?: string | null,
      fullName: string,
      healthNotes?: string | null,
      homeAddress?: string | null,
      homeCity?: string | null,
      livesWithBothParents?: boolean | null,
      motherEmail?: string | null,
      motherName?: string | null,
      motherPhone?: string | null,
      motherProfession?: string | null,
      receivesSocialAssistance?: boolean | null,
    } | null,
    tags?: Array< string | null > | null,
    updatedAt: string,
    updatedByEmail?: string | null,
    updatedBySub?: string | null,
    userId: string,
    userType: UserType,
  } | null,
};

export type DeleteUserRoleAssignmentMutationVariables = {
  condition?: ModelUserRoleAssignmentConditionInput | null,
  input: DeleteUserRoleAssignmentInput,
};

export type DeleteUserRoleAssignmentMutation = {
  deleteUserRoleAssignment?:  {
    __typename: "UserRoleAssignment",
    cognitoSub?: string | null,
    createdAt: string,
    id: string,
    notes?: string | null,
    primaryEmail: string,
    primaryEmailLower: string,
    roles: Array< string | null >,
    updatedAt: string,
    updatedByEmail?: string | null,
    updatedBySub?: string | null,
    verifiedEmails?: Array< string | null > | null,
  } | null,
};

export type DeleteWorkApplicationMutationVariables = {
  condition?: ModelWorkApplicationConditionInput | null,
  input: DeleteWorkApplicationInput,
};

export type DeleteWorkApplicationMutation = {
  deleteWorkApplication?:  {
    __typename: "WorkApplication",
    comments?: string | null,
    coverLetter: string,
    createdAt: string,
    email: string,
    fullName: string,
    id: string,
    owner?: string | null,
    phone: string,
    position: string,
    resumeKey: string,
    updatedAt: string,
  } | null,
};

export type NotifyDeviceLoanRequestMutationVariables = {
  id: string,
};

export type NotifyDeviceLoanRequestMutation = {
  notifyDeviceLoanRequest: boolean,
};

export type SetDeviceLoanStatusMutationVariables = {
  id: string,
  notes?: string | null,
  status: DeviceLoanStatus,
};

export type SetDeviceLoanStatusMutation = {
  setDeviceLoanStatus?:  {
    __typename: "DeviceLoanRequest",
    borrowDate: string,
    createdAt: string,
    email: string,
    fullName: string,
    grade?: string | null,
    id: string,
    notes?: string | null,
    owner: string,
    reason: string,
    requesterId: string,
    returnDate: string,
    status: DeviceLoanStatus,
    updatedAt: string,
  } | null,
};

export type UpdateCognitoSyncStateMutationVariables = {
  condition?: ModelCognitoSyncStateConditionInput | null,
  input: UpdateCognitoSyncStateInput,
};

export type UpdateCognitoSyncStateMutation = {
  updateCognitoSyncState?:  {
    __typename: "CognitoSyncState",
    createdAt: string,
    id: string,
    lastRunAt: string,
    updatedAt: string,
    updatedByEmail?: string | null,
    updatedBySub?: string | null,
  } | null,
};

export type UpdateDashboardPreferenceMutationVariables = {
  condition?: ModelDashboardPreferenceConditionInput | null,
  input: UpdateDashboardPreferenceInput,
};

export type UpdateDashboardPreferenceMutation = {
  updateDashboardPreference?:  {
    __typename: "DashboardPreference",
    createdAt: string,
    favoriteFeatureKeys: Array< string | null >,
    owner: string,
    updatedAt: string,
  } | null,
};

export type UpdateDeviceLoanEventMutationVariables = {
  condition?: ModelDeviceLoanEventConditionInput | null,
  input: UpdateDeviceLoanEventInput,
};

export type UpdateDeviceLoanEventMutation = {
  updateDeviceLoanEvent?:  {
    __typename: "DeviceLoanEvent",
    changedAt: string,
    changedByEmail?: string | null,
    changedByGroups?: Array< string | null > | null,
    changedByName?: string | null,
    changedBySub: string,
    createdAt: string,
    id: string,
    newStatus: DeviceLoanStatus,
    notes?: string | null,
    oldStatus?: DeviceLoanStatus | null,
    owner: string,
    requestId: string,
    updatedAt: string,
  } | null,
};

export type UpdateDeviceLoanRequestMutationVariables = {
  condition?: ModelDeviceLoanRequestConditionInput | null,
  input: UpdateDeviceLoanRequestInput,
};

export type UpdateDeviceLoanRequestMutation = {
  updateDeviceLoanRequest?:  {
    __typename: "DeviceLoanRequest",
    borrowDate: string,
    createdAt: string,
    email: string,
    fullName: string,
    grade?: string | null,
    id: string,
    notes?: string | null,
    owner: string,
    reason: string,
    requesterId: string,
    returnDate: string,
    status: DeviceLoanStatus,
    updatedAt: string,
  } | null,
};

export type UpdateReservationMutationVariables = {
  condition?: ModelReservationConditionInput | null,
  input: UpdateReservationInput,
};

export type UpdateReservationMutation = {
  updateReservation?:  {
    __typename: "Reservation",
    comments?: string | null,
    createdAt: string,
    date: string,
    email?: string | null,
    fullName?: string | null,
    hour: number,
    owner?: string | null,
    phone?: string | null,
    requesterEmail?: string | null,
    requesterId?: string | null,
    requesterName?: string | null,
    updatedAt: string,
  } | null,
};

export type UpdateStudentApplicationMutationVariables = {
  condition?: ModelStudentApplicationConditionInput | null,
  input: UpdateStudentApplicationInput,
};

export type UpdateStudentApplicationMutation = {
  updateStudentApplication?:  {
    __typename: "StudentApplication",
    address?: string | null,
    city?: string | null,
    comments?: string | null,
    createdAt: string,
    currentSchool?: string | null,
    desiredGrade: string,
    dob: string,
    email?: string | null,
    fatherEmail?: string | null,
    fatherJob?: string | null,
    fatherName?: string | null,
    fatherPhone?: string | null,
    fullName: string,
    gender?: string | null,
    id: string,
    livesWithParents?: string | null,
    livesWithParentsComment?: string | null,
    medicalNotes?: string | null,
    motherEmail?: string | null,
    motherJob?: string | null,
    motherName?: string | null,
    motherPhone?: string | null,
    motivation: string,
    owner?: string | null,
    parentEmail?: string | null,
    parentName?: string | null,
    parentPhone?: string | null,
    phone?: string | null,
    socialAssistance?: string | null,
    updatedAt: string,
  } | null,
};

export type UpdateUserProfileMutationVariables = {
  condition?: ModelUserProfileConditionInput | null,
  input: UpdateUserProfileInput,
};

export type UpdateUserProfileMutation = {
  updateUserProfile?:  {
    __typename: "UserProfile",
    archivedAt?: string | null,
    completedAt?: string | null,
    createdAt: string,
    deactivatedAt?: string | null,
    displayName?: string | null,
    lastReviewedAt?: string | null,
    legalName?: string | null,
    notes?: string | null,
    phoneNumbers?: Array< string | null > | null,
    pk: string,
    preferredName?: string | null,
    primaryEmail?: string | null,
    primaryEmailLower?: string | null,
    secondaryEmails?: Array< string | null > | null,
    sk: string,
    status: ProfileLifecycleStatus,
    student?:  {
      __typename: "StudentProfile",
      comments?: string | null,
      dateOfBirth?: string | null,
      fatherEmail?: string | null,
      fatherName?: string | null,
      fatherPhone?: string | null,
      fatherProfession?: string | null,
      fullName: string,
      healthNotes?: string | null,
      homeAddress?: string | null,
      homeCity?: string | null,
      livesWithBothParents?: boolean | null,
      motherEmail?: string | null,
      motherName?: string | null,
      motherPhone?: string | null,
      motherProfession?: string | null,
      receivesSocialAssistance?: boolean | null,
    } | null,
    tags?: Array< string | null > | null,
    updatedAt: string,
    updatedByEmail?: string | null,
    updatedBySub?: string | null,
    userId: string,
    userType: UserType,
  } | null,
};

export type UpdateUserRoleAssignmentMutationVariables = {
  condition?: ModelUserRoleAssignmentConditionInput | null,
  input: UpdateUserRoleAssignmentInput,
};

export type UpdateUserRoleAssignmentMutation = {
  updateUserRoleAssignment?:  {
    __typename: "UserRoleAssignment",
    cognitoSub?: string | null,
    createdAt: string,
    id: string,
    notes?: string | null,
    primaryEmail: string,
    primaryEmailLower: string,
    roles: Array< string | null >,
    updatedAt: string,
    updatedByEmail?: string | null,
    updatedBySub?: string | null,
    verifiedEmails?: Array< string | null > | null,
  } | null,
};

export type UpdateWorkApplicationMutationVariables = {
  condition?: ModelWorkApplicationConditionInput | null,
  input: UpdateWorkApplicationInput,
};

export type UpdateWorkApplicationMutation = {
  updateWorkApplication?:  {
    __typename: "WorkApplication",
    comments?: string | null,
    coverLetter: string,
    createdAt: string,
    email: string,
    fullName: string,
    id: string,
    owner?: string | null,
    phone: string,
    position: string,
    resumeKey: string,
    updatedAt: string,
  } | null,
};

export type OnCreateCognitoSyncStateSubscriptionVariables = {
  filter?: ModelSubscriptionCognitoSyncStateFilterInput | null,
};

export type OnCreateCognitoSyncStateSubscription = {
  onCreateCognitoSyncState?:  {
    __typename: "CognitoSyncState",
    createdAt: string,
    id: string,
    lastRunAt: string,
    updatedAt: string,
    updatedByEmail?: string | null,
    updatedBySub?: string | null,
  } | null,
};

export type OnCreateDashboardPreferenceSubscriptionVariables = {
  filter?: ModelSubscriptionDashboardPreferenceFilterInput | null,
  owner?: string | null,
};

export type OnCreateDashboardPreferenceSubscription = {
  onCreateDashboardPreference?:  {
    __typename: "DashboardPreference",
    createdAt: string,
    favoriteFeatureKeys: Array< string | null >,
    owner: string,
    updatedAt: string,
  } | null,
};

export type OnCreateDeviceLoanEventSubscriptionVariables = {
  filter?: ModelSubscriptionDeviceLoanEventFilterInput | null,
  owner?: string | null,
};

export type OnCreateDeviceLoanEventSubscription = {
  onCreateDeviceLoanEvent?:  {
    __typename: "DeviceLoanEvent",
    changedAt: string,
    changedByEmail?: string | null,
    changedByGroups?: Array< string | null > | null,
    changedByName?: string | null,
    changedBySub: string,
    createdAt: string,
    id: string,
    newStatus: DeviceLoanStatus,
    notes?: string | null,
    oldStatus?: DeviceLoanStatus | null,
    owner: string,
    requestId: string,
    updatedAt: string,
  } | null,
};

export type OnCreateDeviceLoanRequestSubscriptionVariables = {
  filter?: ModelSubscriptionDeviceLoanRequestFilterInput | null,
  owner?: string | null,
};

export type OnCreateDeviceLoanRequestSubscription = {
  onCreateDeviceLoanRequest?:  {
    __typename: "DeviceLoanRequest",
    borrowDate: string,
    createdAt: string,
    email: string,
    fullName: string,
    grade?: string | null,
    id: string,
    notes?: string | null,
    owner: string,
    reason: string,
    requesterId: string,
    returnDate: string,
    status: DeviceLoanStatus,
    updatedAt: string,
  } | null,
};

export type OnCreateReservationSubscriptionVariables = {
  filter?: ModelSubscriptionReservationFilterInput | null,
  owner?: string | null,
};

export type OnCreateReservationSubscription = {
  onCreateReservation?:  {
    __typename: "Reservation",
    comments?: string | null,
    createdAt: string,
    date: string,
    email?: string | null,
    fullName?: string | null,
    hour: number,
    owner?: string | null,
    phone?: string | null,
    requesterEmail?: string | null,
    requesterId?: string | null,
    requesterName?: string | null,
    updatedAt: string,
  } | null,
};

export type OnCreateStudentApplicationSubscriptionVariables = {
  filter?: ModelSubscriptionStudentApplicationFilterInput | null,
  owner?: string | null,
};

export type OnCreateStudentApplicationSubscription = {
  onCreateStudentApplication?:  {
    __typename: "StudentApplication",
    address?: string | null,
    city?: string | null,
    comments?: string | null,
    createdAt: string,
    currentSchool?: string | null,
    desiredGrade: string,
    dob: string,
    email?: string | null,
    fatherEmail?: string | null,
    fatherJob?: string | null,
    fatherName?: string | null,
    fatherPhone?: string | null,
    fullName: string,
    gender?: string | null,
    id: string,
    livesWithParents?: string | null,
    livesWithParentsComment?: string | null,
    medicalNotes?: string | null,
    motherEmail?: string | null,
    motherJob?: string | null,
    motherName?: string | null,
    motherPhone?: string | null,
    motivation: string,
    owner?: string | null,
    parentEmail?: string | null,
    parentName?: string | null,
    parentPhone?: string | null,
    phone?: string | null,
    socialAssistance?: string | null,
    updatedAt: string,
  } | null,
};

export type OnCreateUserProfileSubscriptionVariables = {
  filter?: ModelSubscriptionUserProfileFilterInput | null,
};

export type OnCreateUserProfileSubscription = {
  onCreateUserProfile?:  {
    __typename: "UserProfile",
    archivedAt?: string | null,
    completedAt?: string | null,
    createdAt: string,
    deactivatedAt?: string | null,
    displayName?: string | null,
    lastReviewedAt?: string | null,
    legalName?: string | null,
    notes?: string | null,
    phoneNumbers?: Array< string | null > | null,
    pk: string,
    preferredName?: string | null,
    primaryEmail?: string | null,
    primaryEmailLower?: string | null,
    secondaryEmails?: Array< string | null > | null,
    sk: string,
    status: ProfileLifecycleStatus,
    student?:  {
      __typename: "StudentProfile",
      comments?: string | null,
      dateOfBirth?: string | null,
      fatherEmail?: string | null,
      fatherName?: string | null,
      fatherPhone?: string | null,
      fatherProfession?: string | null,
      fullName: string,
      healthNotes?: string | null,
      homeAddress?: string | null,
      homeCity?: string | null,
      livesWithBothParents?: boolean | null,
      motherEmail?: string | null,
      motherName?: string | null,
      motherPhone?: string | null,
      motherProfession?: string | null,
      receivesSocialAssistance?: boolean | null,
    } | null,
    tags?: Array< string | null > | null,
    updatedAt: string,
    updatedByEmail?: string | null,
    updatedBySub?: string | null,
    userId: string,
    userType: UserType,
  } | null,
};

export type OnCreateUserRoleAssignmentSubscriptionVariables = {
  filter?: ModelSubscriptionUserRoleAssignmentFilterInput | null,
};

export type OnCreateUserRoleAssignmentSubscription = {
  onCreateUserRoleAssignment?:  {
    __typename: "UserRoleAssignment",
    cognitoSub?: string | null,
    createdAt: string,
    id: string,
    notes?: string | null,
    primaryEmail: string,
    primaryEmailLower: string,
    roles: Array< string | null >,
    updatedAt: string,
    updatedByEmail?: string | null,
    updatedBySub?: string | null,
    verifiedEmails?: Array< string | null > | null,
  } | null,
};

export type OnCreateWorkApplicationSubscriptionVariables = {
  filter?: ModelSubscriptionWorkApplicationFilterInput | null,
  owner?: string | null,
};

export type OnCreateWorkApplicationSubscription = {
  onCreateWorkApplication?:  {
    __typename: "WorkApplication",
    comments?: string | null,
    coverLetter: string,
    createdAt: string,
    email: string,
    fullName: string,
    id: string,
    owner?: string | null,
    phone: string,
    position: string,
    resumeKey: string,
    updatedAt: string,
  } | null,
};

export type OnDeleteCognitoSyncStateSubscriptionVariables = {
  filter?: ModelSubscriptionCognitoSyncStateFilterInput | null,
};

export type OnDeleteCognitoSyncStateSubscription = {
  onDeleteCognitoSyncState?:  {
    __typename: "CognitoSyncState",
    createdAt: string,
    id: string,
    lastRunAt: string,
    updatedAt: string,
    updatedByEmail?: string | null,
    updatedBySub?: string | null,
  } | null,
};

export type OnDeleteDashboardPreferenceSubscriptionVariables = {
  filter?: ModelSubscriptionDashboardPreferenceFilterInput | null,
  owner?: string | null,
};

export type OnDeleteDashboardPreferenceSubscription = {
  onDeleteDashboardPreference?:  {
    __typename: "DashboardPreference",
    createdAt: string,
    favoriteFeatureKeys: Array< string | null >,
    owner: string,
    updatedAt: string,
  } | null,
};

export type OnDeleteDeviceLoanEventSubscriptionVariables = {
  filter?: ModelSubscriptionDeviceLoanEventFilterInput | null,
  owner?: string | null,
};

export type OnDeleteDeviceLoanEventSubscription = {
  onDeleteDeviceLoanEvent?:  {
    __typename: "DeviceLoanEvent",
    changedAt: string,
    changedByEmail?: string | null,
    changedByGroups?: Array< string | null > | null,
    changedByName?: string | null,
    changedBySub: string,
    createdAt: string,
    id: string,
    newStatus: DeviceLoanStatus,
    notes?: string | null,
    oldStatus?: DeviceLoanStatus | null,
    owner: string,
    requestId: string,
    updatedAt: string,
  } | null,
};

export type OnDeleteDeviceLoanRequestSubscriptionVariables = {
  filter?: ModelSubscriptionDeviceLoanRequestFilterInput | null,
  owner?: string | null,
};

export type OnDeleteDeviceLoanRequestSubscription = {
  onDeleteDeviceLoanRequest?:  {
    __typename: "DeviceLoanRequest",
    borrowDate: string,
    createdAt: string,
    email: string,
    fullName: string,
    grade?: string | null,
    id: string,
    notes?: string | null,
    owner: string,
    reason: string,
    requesterId: string,
    returnDate: string,
    status: DeviceLoanStatus,
    updatedAt: string,
  } | null,
};

export type OnDeleteReservationSubscriptionVariables = {
  filter?: ModelSubscriptionReservationFilterInput | null,
  owner?: string | null,
};

export type OnDeleteReservationSubscription = {
  onDeleteReservation?:  {
    __typename: "Reservation",
    comments?: string | null,
    createdAt: string,
    date: string,
    email?: string | null,
    fullName?: string | null,
    hour: number,
    owner?: string | null,
    phone?: string | null,
    requesterEmail?: string | null,
    requesterId?: string | null,
    requesterName?: string | null,
    updatedAt: string,
  } | null,
};

export type OnDeleteStudentApplicationSubscriptionVariables = {
  filter?: ModelSubscriptionStudentApplicationFilterInput | null,
  owner?: string | null,
};

export type OnDeleteStudentApplicationSubscription = {
  onDeleteStudentApplication?:  {
    __typename: "StudentApplication",
    address?: string | null,
    city?: string | null,
    comments?: string | null,
    createdAt: string,
    currentSchool?: string | null,
    desiredGrade: string,
    dob: string,
    email?: string | null,
    fatherEmail?: string | null,
    fatherJob?: string | null,
    fatherName?: string | null,
    fatherPhone?: string | null,
    fullName: string,
    gender?: string | null,
    id: string,
    livesWithParents?: string | null,
    livesWithParentsComment?: string | null,
    medicalNotes?: string | null,
    motherEmail?: string | null,
    motherJob?: string | null,
    motherName?: string | null,
    motherPhone?: string | null,
    motivation: string,
    owner?: string | null,
    parentEmail?: string | null,
    parentName?: string | null,
    parentPhone?: string | null,
    phone?: string | null,
    socialAssistance?: string | null,
    updatedAt: string,
  } | null,
};

export type OnDeleteUserProfileSubscriptionVariables = {
  filter?: ModelSubscriptionUserProfileFilterInput | null,
};

export type OnDeleteUserProfileSubscription = {
  onDeleteUserProfile?:  {
    __typename: "UserProfile",
    archivedAt?: string | null,
    completedAt?: string | null,
    createdAt: string,
    deactivatedAt?: string | null,
    displayName?: string | null,
    lastReviewedAt?: string | null,
    legalName?: string | null,
    notes?: string | null,
    phoneNumbers?: Array< string | null > | null,
    pk: string,
    preferredName?: string | null,
    primaryEmail?: string | null,
    primaryEmailLower?: string | null,
    secondaryEmails?: Array< string | null > | null,
    sk: string,
    status: ProfileLifecycleStatus,
    student?:  {
      __typename: "StudentProfile",
      comments?: string | null,
      dateOfBirth?: string | null,
      fatherEmail?: string | null,
      fatherName?: string | null,
      fatherPhone?: string | null,
      fatherProfession?: string | null,
      fullName: string,
      healthNotes?: string | null,
      homeAddress?: string | null,
      homeCity?: string | null,
      livesWithBothParents?: boolean | null,
      motherEmail?: string | null,
      motherName?: string | null,
      motherPhone?: string | null,
      motherProfession?: string | null,
      receivesSocialAssistance?: boolean | null,
    } | null,
    tags?: Array< string | null > | null,
    updatedAt: string,
    updatedByEmail?: string | null,
    updatedBySub?: string | null,
    userId: string,
    userType: UserType,
  } | null,
};

export type OnDeleteUserRoleAssignmentSubscriptionVariables = {
  filter?: ModelSubscriptionUserRoleAssignmentFilterInput | null,
};

export type OnDeleteUserRoleAssignmentSubscription = {
  onDeleteUserRoleAssignment?:  {
    __typename: "UserRoleAssignment",
    cognitoSub?: string | null,
    createdAt: string,
    id: string,
    notes?: string | null,
    primaryEmail: string,
    primaryEmailLower: string,
    roles: Array< string | null >,
    updatedAt: string,
    updatedByEmail?: string | null,
    updatedBySub?: string | null,
    verifiedEmails?: Array< string | null > | null,
  } | null,
};

export type OnDeleteWorkApplicationSubscriptionVariables = {
  filter?: ModelSubscriptionWorkApplicationFilterInput | null,
  owner?: string | null,
};

export type OnDeleteWorkApplicationSubscription = {
  onDeleteWorkApplication?:  {
    __typename: "WorkApplication",
    comments?: string | null,
    coverLetter: string,
    createdAt: string,
    email: string,
    fullName: string,
    id: string,
    owner?: string | null,
    phone: string,
    position: string,
    resumeKey: string,
    updatedAt: string,
  } | null,
};

export type OnUpdateCognitoSyncStateSubscriptionVariables = {
  filter?: ModelSubscriptionCognitoSyncStateFilterInput | null,
};

export type OnUpdateCognitoSyncStateSubscription = {
  onUpdateCognitoSyncState?:  {
    __typename: "CognitoSyncState",
    createdAt: string,
    id: string,
    lastRunAt: string,
    updatedAt: string,
    updatedByEmail?: string | null,
    updatedBySub?: string | null,
  } | null,
};

export type OnUpdateDashboardPreferenceSubscriptionVariables = {
  filter?: ModelSubscriptionDashboardPreferenceFilterInput | null,
  owner?: string | null,
};

export type OnUpdateDashboardPreferenceSubscription = {
  onUpdateDashboardPreference?:  {
    __typename: "DashboardPreference",
    createdAt: string,
    favoriteFeatureKeys: Array< string | null >,
    owner: string,
    updatedAt: string,
  } | null,
};

export type OnUpdateDeviceLoanEventSubscriptionVariables = {
  filter?: ModelSubscriptionDeviceLoanEventFilterInput | null,
  owner?: string | null,
};

export type OnUpdateDeviceLoanEventSubscription = {
  onUpdateDeviceLoanEvent?:  {
    __typename: "DeviceLoanEvent",
    changedAt: string,
    changedByEmail?: string | null,
    changedByGroups?: Array< string | null > | null,
    changedByName?: string | null,
    changedBySub: string,
    createdAt: string,
    id: string,
    newStatus: DeviceLoanStatus,
    notes?: string | null,
    oldStatus?: DeviceLoanStatus | null,
    owner: string,
    requestId: string,
    updatedAt: string,
  } | null,
};

export type OnUpdateDeviceLoanRequestSubscriptionVariables = {
  filter?: ModelSubscriptionDeviceLoanRequestFilterInput | null,
  owner?: string | null,
};

export type OnUpdateDeviceLoanRequestSubscription = {
  onUpdateDeviceLoanRequest?:  {
    __typename: "DeviceLoanRequest",
    borrowDate: string,
    createdAt: string,
    email: string,
    fullName: string,
    grade?: string | null,
    id: string,
    notes?: string | null,
    owner: string,
    reason: string,
    requesterId: string,
    returnDate: string,
    status: DeviceLoanStatus,
    updatedAt: string,
  } | null,
};

export type OnUpdateReservationSubscriptionVariables = {
  filter?: ModelSubscriptionReservationFilterInput | null,
  owner?: string | null,
};

export type OnUpdateReservationSubscription = {
  onUpdateReservation?:  {
    __typename: "Reservation",
    comments?: string | null,
    createdAt: string,
    date: string,
    email?: string | null,
    fullName?: string | null,
    hour: number,
    owner?: string | null,
    phone?: string | null,
    requesterEmail?: string | null,
    requesterId?: string | null,
    requesterName?: string | null,
    updatedAt: string,
  } | null,
};

export type OnUpdateStudentApplicationSubscriptionVariables = {
  filter?: ModelSubscriptionStudentApplicationFilterInput | null,
  owner?: string | null,
};

export type OnUpdateStudentApplicationSubscription = {
  onUpdateStudentApplication?:  {
    __typename: "StudentApplication",
    address?: string | null,
    city?: string | null,
    comments?: string | null,
    createdAt: string,
    currentSchool?: string | null,
    desiredGrade: string,
    dob: string,
    email?: string | null,
    fatherEmail?: string | null,
    fatherJob?: string | null,
    fatherName?: string | null,
    fatherPhone?: string | null,
    fullName: string,
    gender?: string | null,
    id: string,
    livesWithParents?: string | null,
    livesWithParentsComment?: string | null,
    medicalNotes?: string | null,
    motherEmail?: string | null,
    motherJob?: string | null,
    motherName?: string | null,
    motherPhone?: string | null,
    motivation: string,
    owner?: string | null,
    parentEmail?: string | null,
    parentName?: string | null,
    parentPhone?: string | null,
    phone?: string | null,
    socialAssistance?: string | null,
    updatedAt: string,
  } | null,
};

export type OnUpdateUserProfileSubscriptionVariables = {
  filter?: ModelSubscriptionUserProfileFilterInput | null,
};

export type OnUpdateUserProfileSubscription = {
  onUpdateUserProfile?:  {
    __typename: "UserProfile",
    archivedAt?: string | null,
    completedAt?: string | null,
    createdAt: string,
    deactivatedAt?: string | null,
    displayName?: string | null,
    lastReviewedAt?: string | null,
    legalName?: string | null,
    notes?: string | null,
    phoneNumbers?: Array< string | null > | null,
    pk: string,
    preferredName?: string | null,
    primaryEmail?: string | null,
    primaryEmailLower?: string | null,
    secondaryEmails?: Array< string | null > | null,
    sk: string,
    status: ProfileLifecycleStatus,
    student?:  {
      __typename: "StudentProfile",
      comments?: string | null,
      dateOfBirth?: string | null,
      fatherEmail?: string | null,
      fatherName?: string | null,
      fatherPhone?: string | null,
      fatherProfession?: string | null,
      fullName: string,
      healthNotes?: string | null,
      homeAddress?: string | null,
      homeCity?: string | null,
      livesWithBothParents?: boolean | null,
      motherEmail?: string | null,
      motherName?: string | null,
      motherPhone?: string | null,
      motherProfession?: string | null,
      receivesSocialAssistance?: boolean | null,
    } | null,
    tags?: Array< string | null > | null,
    updatedAt: string,
    updatedByEmail?: string | null,
    updatedBySub?: string | null,
    userId: string,
    userType: UserType,
  } | null,
};

export type OnUpdateUserRoleAssignmentSubscriptionVariables = {
  filter?: ModelSubscriptionUserRoleAssignmentFilterInput | null,
};

export type OnUpdateUserRoleAssignmentSubscription = {
  onUpdateUserRoleAssignment?:  {
    __typename: "UserRoleAssignment",
    cognitoSub?: string | null,
    createdAt: string,
    id: string,
    notes?: string | null,
    primaryEmail: string,
    primaryEmailLower: string,
    roles: Array< string | null >,
    updatedAt: string,
    updatedByEmail?: string | null,
    updatedBySub?: string | null,
    verifiedEmails?: Array< string | null > | null,
  } | null,
};

export type OnUpdateWorkApplicationSubscriptionVariables = {
  filter?: ModelSubscriptionWorkApplicationFilterInput | null,
  owner?: string | null,
};

export type OnUpdateWorkApplicationSubscription = {
  onUpdateWorkApplication?:  {
    __typename: "WorkApplication",
    comments?: string | null,
    coverLetter: string,
    createdAt: string,
    email: string,
    fullName: string,
    id: string,
    owner?: string | null,
    phone: string,
    position: string,
    resumeKey: string,
    updatedAt: string,
  } | null,
};
