/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "./API";
type GeneratedMutation<InputType, OutputType> = string & {
  __generatedMutationInput: InputType;
  __generatedMutationOutput: OutputType;
};

export const adminBulkUpdateUserRoles = /* GraphQL */ `mutation AdminBulkUpdateUserRoles(
  $action: String!
  $primaryEmails: [String]!
  $roles: [String]!
) {
  adminBulkUpdateUserRoles(
    action: $action
    primaryEmails: $primaryEmails
    roles: $roles
  ) {
    failedCount
    failures
    successes
    updatedCount
    __typename
  }
}
` as GeneratedMutation<
  APITypes.AdminBulkUpdateUserRolesMutationVariables,
  APITypes.AdminBulkUpdateUserRolesMutation
>;
export const adminDeleteUserRoleAssignments = /* GraphQL */ `mutation AdminDeleteUserRoleAssignments($primaryEmails: [String]!) {
  adminDeleteUserRoleAssignments(primaryEmails: $primaryEmails) {
    deletedCount
    failedCount
    failures
    successes
    __typename
  }
}
` as GeneratedMutation<
  APITypes.AdminDeleteUserRoleAssignmentsMutationVariables,
  APITypes.AdminDeleteUserRoleAssignmentsMutation
>;
export const adminImportUserAccounts = /* GraphQL */ `mutation AdminImportUserAccounts($csv: String!) {
  adminImportUserAccounts(csv: $csv)
}
` as GeneratedMutation<
  APITypes.AdminImportUserAccountsMutationVariables,
  APITypes.AdminImportUserAccountsMutation
>;
export const adminSyncCognitoUsers = /* GraphQL */ `mutation AdminSyncCognitoUsers {
  adminSyncCognitoUsers {
    createdCount
    failedCount
    failures {
      email
      reason
      __typename
    }
    missingEmailCount
    skippedCount
    totalAssignmentsAfter
    totalAssignmentsBefore
    totalCognitoUsers
    __typename
  }
}
` as GeneratedMutation<
  APITypes.AdminSyncCognitoUsersMutationVariables,
  APITypes.AdminSyncCognitoUsersMutation
>;
export const adminUpsertUserRoleAssignment = /* GraphQL */ `mutation AdminUpsertUserRoleAssignment(
  $cognitoSub: String
  $notes: String
  $primaryEmail: String!
  $roles: [String]!
  $userId: ID
  $verifiedEmails: [String]
) {
  adminUpsertUserRoleAssignment(
    cognitoSub: $cognitoSub
    notes: $notes
    primaryEmail: $primaryEmail
    roles: $roles
    userId: $userId
    verifiedEmails: $verifiedEmails
  ) {
    cognitoSub
    createdAt
    id
    notes
    primaryEmail
    primaryEmailLower
    roles
    updatedAt
    updatedByEmail
    updatedBySub
    verifiedEmails
    __typename
  }
}
` as GeneratedMutation<
  APITypes.AdminUpsertUserRoleAssignmentMutationVariables,
  APITypes.AdminUpsertUserRoleAssignmentMutation
>;
export const createCognitoSyncState = /* GraphQL */ `mutation CreateCognitoSyncState(
  $condition: ModelCognitoSyncStateConditionInput
  $input: CreateCognitoSyncStateInput!
) {
  createCognitoSyncState(condition: $condition, input: $input) {
    createdAt
    id
    lastRunAt
    updatedAt
    updatedByEmail
    updatedBySub
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateCognitoSyncStateMutationVariables,
  APITypes.CreateCognitoSyncStateMutation
>;
export const createDashboardPreference = /* GraphQL */ `mutation CreateDashboardPreference(
  $condition: ModelDashboardPreferenceConditionInput
  $input: CreateDashboardPreferenceInput!
) {
  createDashboardPreference(condition: $condition, input: $input) {
    createdAt
    favoriteFeatureKeys
    owner
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateDashboardPreferenceMutationVariables,
  APITypes.CreateDashboardPreferenceMutation
>;
export const createDeviceLoanAndNotify = /* GraphQL */ `mutation CreateDeviceLoanAndNotify(
  $borrowDate: AWSDate!
  $email: String
  $fullName: String
  $grade: String
  $reason: String!
  $returnDate: AWSDate!
) {
  createDeviceLoanAndNotify(
    borrowDate: $borrowDate
    email: $email
    fullName: $fullName
    grade: $grade
    reason: $reason
    returnDate: $returnDate
  ) {
    borrowDate
    createdAt
    email
    fullName
    grade
    id
    notes
    owner
    reason
    requesterId
    returnDate
    status
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateDeviceLoanAndNotifyMutationVariables,
  APITypes.CreateDeviceLoanAndNotifyMutation
>;
export const createDeviceLoanEvent = /* GraphQL */ `mutation CreateDeviceLoanEvent(
  $condition: ModelDeviceLoanEventConditionInput
  $input: CreateDeviceLoanEventInput!
) {
  createDeviceLoanEvent(condition: $condition, input: $input) {
    changedAt
    changedByEmail
    changedByGroups
    changedByName
    changedBySub
    createdAt
    id
    newStatus
    notes
    oldStatus
    owner
    requestId
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateDeviceLoanEventMutationVariables,
  APITypes.CreateDeviceLoanEventMutation
>;
export const createDeviceLoanRequest = /* GraphQL */ `mutation CreateDeviceLoanRequest(
  $condition: ModelDeviceLoanRequestConditionInput
  $input: CreateDeviceLoanRequestInput!
) {
  createDeviceLoanRequest(condition: $condition, input: $input) {
    borrowDate
    createdAt
    email
    fullName
    grade
    id
    notes
    owner
    reason
    requesterId
    returnDate
    status
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateDeviceLoanRequestMutationVariables,
  APITypes.CreateDeviceLoanRequestMutation
>;
export const createReservation = /* GraphQL */ `mutation CreateReservation(
  $condition: ModelReservationConditionInput
  $input: CreateReservationInput!
) {
  createReservation(condition: $condition, input: $input) {
    comments
    createdAt
    date
    email
    fullName
    hour
    owner
    phone
    requesterEmail
    requesterId
    requesterName
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateReservationMutationVariables,
  APITypes.CreateReservationMutation
>;
export const createReservationValidated = /* GraphQL */ `mutation CreateReservationValidated(
  $comments: String
  $date: AWSDate!
  $email: String!
  $fullName: String!
  $hour: Int!
  $phone: String
) {
  createReservationValidated(
    comments: $comments
    date: $date
    email: $email
    fullName: $fullName
    hour: $hour
    phone: $phone
  )
}
` as GeneratedMutation<
  APITypes.CreateReservationValidatedMutationVariables,
  APITypes.CreateReservationValidatedMutation
>;
export const createStudentApplication = /* GraphQL */ `mutation CreateStudentApplication(
  $condition: ModelStudentApplicationConditionInput
  $input: CreateStudentApplicationInput!
) {
  createStudentApplication(condition: $condition, input: $input) {
    address
    city
    comments
    createdAt
    currentSchool
    desiredGrade
    dob
    email
    fatherEmail
    fatherJob
    fatherName
    fatherPhone
    fullName
    gender
    id
    livesWithParents
    livesWithParentsComment
    medicalNotes
    motherEmail
    motherJob
    motherName
    motherPhone
    motivation
    owner
    parentEmail
    parentName
    parentPhone
    phone
    socialAssistance
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateStudentApplicationMutationVariables,
  APITypes.CreateStudentApplicationMutation
>;
export const createUserProfile = /* GraphQL */ `mutation CreateUserProfile(
  $condition: ModelUserProfileConditionInput
  $input: CreateUserProfileInput!
) {
  createUserProfile(condition: $condition, input: $input) {
    archivedAt
    completedAt
    createdAt
    deactivatedAt
    displayName
    lastReviewedAt
    legalName
    notes
    phoneNumbers
    pk
    preferredName
    primaryEmail
    primaryEmailLower
    secondaryEmails
    sk
    status
    student {
      comments
      dateOfBirth
      fatherEmail
      fatherName
      fatherPhone
      fatherProfession
      fullName
      healthNotes
      homeAddress
      homeCity
      livesWithBothParents
      motherEmail
      motherName
      motherPhone
      motherProfession
      receivesSocialAssistance
      __typename
    }
    tags
    updatedAt
    updatedByEmail
    updatedBySub
    userId
    userType
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateUserProfileMutationVariables,
  APITypes.CreateUserProfileMutation
>;
export const createUserRoleAssignment = /* GraphQL */ `mutation CreateUserRoleAssignment(
  $condition: ModelUserRoleAssignmentConditionInput
  $input: CreateUserRoleAssignmentInput!
) {
  createUserRoleAssignment(condition: $condition, input: $input) {
    cognitoSub
    createdAt
    id
    notes
    primaryEmail
    primaryEmailLower
    roles
    updatedAt
    updatedByEmail
    updatedBySub
    verifiedEmails
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateUserRoleAssignmentMutationVariables,
  APITypes.CreateUserRoleAssignmentMutation
>;
export const createWorkApplication = /* GraphQL */ `mutation CreateWorkApplication(
  $condition: ModelWorkApplicationConditionInput
  $input: CreateWorkApplicationInput!
) {
  createWorkApplication(condition: $condition, input: $input) {
    comments
    coverLetter
    createdAt
    email
    fullName
    id
    owner
    phone
    position
    resumeKey
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.CreateWorkApplicationMutationVariables,
  APITypes.CreateWorkApplicationMutation
>;
export const deleteCognitoSyncState = /* GraphQL */ `mutation DeleteCognitoSyncState(
  $condition: ModelCognitoSyncStateConditionInput
  $input: DeleteCognitoSyncStateInput!
) {
  deleteCognitoSyncState(condition: $condition, input: $input) {
    createdAt
    id
    lastRunAt
    updatedAt
    updatedByEmail
    updatedBySub
    __typename
  }
}
` as GeneratedMutation<
  APITypes.DeleteCognitoSyncStateMutationVariables,
  APITypes.DeleteCognitoSyncStateMutation
>;
export const deleteDashboardPreference = /* GraphQL */ `mutation DeleteDashboardPreference(
  $condition: ModelDashboardPreferenceConditionInput
  $input: DeleteDashboardPreferenceInput!
) {
  deleteDashboardPreference(condition: $condition, input: $input) {
    createdAt
    favoriteFeatureKeys
    owner
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.DeleteDashboardPreferenceMutationVariables,
  APITypes.DeleteDashboardPreferenceMutation
>;
export const deleteDeviceLoanEvent = /* GraphQL */ `mutation DeleteDeviceLoanEvent(
  $condition: ModelDeviceLoanEventConditionInput
  $input: DeleteDeviceLoanEventInput!
) {
  deleteDeviceLoanEvent(condition: $condition, input: $input) {
    changedAt
    changedByEmail
    changedByGroups
    changedByName
    changedBySub
    createdAt
    id
    newStatus
    notes
    oldStatus
    owner
    requestId
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.DeleteDeviceLoanEventMutationVariables,
  APITypes.DeleteDeviceLoanEventMutation
>;
export const deleteDeviceLoanRequest = /* GraphQL */ `mutation DeleteDeviceLoanRequest(
  $condition: ModelDeviceLoanRequestConditionInput
  $input: DeleteDeviceLoanRequestInput!
) {
  deleteDeviceLoanRequest(condition: $condition, input: $input) {
    borrowDate
    createdAt
    email
    fullName
    grade
    id
    notes
    owner
    reason
    requesterId
    returnDate
    status
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.DeleteDeviceLoanRequestMutationVariables,
  APITypes.DeleteDeviceLoanRequestMutation
>;
export const deleteReservation = /* GraphQL */ `mutation DeleteReservation(
  $condition: ModelReservationConditionInput
  $input: DeleteReservationInput!
) {
  deleteReservation(condition: $condition, input: $input) {
    comments
    createdAt
    date
    email
    fullName
    hour
    owner
    phone
    requesterEmail
    requesterId
    requesterName
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.DeleteReservationMutationVariables,
  APITypes.DeleteReservationMutation
>;
export const deleteStudentApplication = /* GraphQL */ `mutation DeleteStudentApplication(
  $condition: ModelStudentApplicationConditionInput
  $input: DeleteStudentApplicationInput!
) {
  deleteStudentApplication(condition: $condition, input: $input) {
    address
    city
    comments
    createdAt
    currentSchool
    desiredGrade
    dob
    email
    fatherEmail
    fatherJob
    fatherName
    fatherPhone
    fullName
    gender
    id
    livesWithParents
    livesWithParentsComment
    medicalNotes
    motherEmail
    motherJob
    motherName
    motherPhone
    motivation
    owner
    parentEmail
    parentName
    parentPhone
    phone
    socialAssistance
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.DeleteStudentApplicationMutationVariables,
  APITypes.DeleteStudentApplicationMutation
>;
export const deleteUserProfile = /* GraphQL */ `mutation DeleteUserProfile(
  $condition: ModelUserProfileConditionInput
  $input: DeleteUserProfileInput!
) {
  deleteUserProfile(condition: $condition, input: $input) {
    archivedAt
    completedAt
    createdAt
    deactivatedAt
    displayName
    lastReviewedAt
    legalName
    notes
    phoneNumbers
    pk
    preferredName
    primaryEmail
    primaryEmailLower
    secondaryEmails
    sk
    status
    student {
      comments
      dateOfBirth
      fatherEmail
      fatherName
      fatherPhone
      fatherProfession
      fullName
      healthNotes
      homeAddress
      homeCity
      livesWithBothParents
      motherEmail
      motherName
      motherPhone
      motherProfession
      receivesSocialAssistance
      __typename
    }
    tags
    updatedAt
    updatedByEmail
    updatedBySub
    userId
    userType
    __typename
  }
}
` as GeneratedMutation<
  APITypes.DeleteUserProfileMutationVariables,
  APITypes.DeleteUserProfileMutation
>;
export const deleteUserRoleAssignment = /* GraphQL */ `mutation DeleteUserRoleAssignment(
  $condition: ModelUserRoleAssignmentConditionInput
  $input: DeleteUserRoleAssignmentInput!
) {
  deleteUserRoleAssignment(condition: $condition, input: $input) {
    cognitoSub
    createdAt
    id
    notes
    primaryEmail
    primaryEmailLower
    roles
    updatedAt
    updatedByEmail
    updatedBySub
    verifiedEmails
    __typename
  }
}
` as GeneratedMutation<
  APITypes.DeleteUserRoleAssignmentMutationVariables,
  APITypes.DeleteUserRoleAssignmentMutation
>;
export const deleteWorkApplication = /* GraphQL */ `mutation DeleteWorkApplication(
  $condition: ModelWorkApplicationConditionInput
  $input: DeleteWorkApplicationInput!
) {
  deleteWorkApplication(condition: $condition, input: $input) {
    comments
    coverLetter
    createdAt
    email
    fullName
    id
    owner
    phone
    position
    resumeKey
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.DeleteWorkApplicationMutationVariables,
  APITypes.DeleteWorkApplicationMutation
>;
export const notifyDeviceLoanRequest = /* GraphQL */ `mutation NotifyDeviceLoanRequest($id: ID!) {
  notifyDeviceLoanRequest(id: $id)
}
` as GeneratedMutation<
  APITypes.NotifyDeviceLoanRequestMutationVariables,
  APITypes.NotifyDeviceLoanRequestMutation
>;
export const setDeviceLoanStatus = /* GraphQL */ `mutation SetDeviceLoanStatus(
  $id: ID!
  $notes: String
  $status: DeviceLoanStatus!
) {
  setDeviceLoanStatus(id: $id, notes: $notes, status: $status) {
    borrowDate
    createdAt
    email
    fullName
    grade
    id
    notes
    owner
    reason
    requesterId
    returnDate
    status
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.SetDeviceLoanStatusMutationVariables,
  APITypes.SetDeviceLoanStatusMutation
>;
export const updateCognitoSyncState = /* GraphQL */ `mutation UpdateCognitoSyncState(
  $condition: ModelCognitoSyncStateConditionInput
  $input: UpdateCognitoSyncStateInput!
) {
  updateCognitoSyncState(condition: $condition, input: $input) {
    createdAt
    id
    lastRunAt
    updatedAt
    updatedByEmail
    updatedBySub
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdateCognitoSyncStateMutationVariables,
  APITypes.UpdateCognitoSyncStateMutation
>;
export const updateDashboardPreference = /* GraphQL */ `mutation UpdateDashboardPreference(
  $condition: ModelDashboardPreferenceConditionInput
  $input: UpdateDashboardPreferenceInput!
) {
  updateDashboardPreference(condition: $condition, input: $input) {
    createdAt
    favoriteFeatureKeys
    owner
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdateDashboardPreferenceMutationVariables,
  APITypes.UpdateDashboardPreferenceMutation
>;
export const updateDeviceLoanEvent = /* GraphQL */ `mutation UpdateDeviceLoanEvent(
  $condition: ModelDeviceLoanEventConditionInput
  $input: UpdateDeviceLoanEventInput!
) {
  updateDeviceLoanEvent(condition: $condition, input: $input) {
    changedAt
    changedByEmail
    changedByGroups
    changedByName
    changedBySub
    createdAt
    id
    newStatus
    notes
    oldStatus
    owner
    requestId
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdateDeviceLoanEventMutationVariables,
  APITypes.UpdateDeviceLoanEventMutation
>;
export const updateDeviceLoanRequest = /* GraphQL */ `mutation UpdateDeviceLoanRequest(
  $condition: ModelDeviceLoanRequestConditionInput
  $input: UpdateDeviceLoanRequestInput!
) {
  updateDeviceLoanRequest(condition: $condition, input: $input) {
    borrowDate
    createdAt
    email
    fullName
    grade
    id
    notes
    owner
    reason
    requesterId
    returnDate
    status
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdateDeviceLoanRequestMutationVariables,
  APITypes.UpdateDeviceLoanRequestMutation
>;
export const updateReservation = /* GraphQL */ `mutation UpdateReservation(
  $condition: ModelReservationConditionInput
  $input: UpdateReservationInput!
) {
  updateReservation(condition: $condition, input: $input) {
    comments
    createdAt
    date
    email
    fullName
    hour
    owner
    phone
    requesterEmail
    requesterId
    requesterName
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdateReservationMutationVariables,
  APITypes.UpdateReservationMutation
>;
export const updateStudentApplication = /* GraphQL */ `mutation UpdateStudentApplication(
  $condition: ModelStudentApplicationConditionInput
  $input: UpdateStudentApplicationInput!
) {
  updateStudentApplication(condition: $condition, input: $input) {
    address
    city
    comments
    createdAt
    currentSchool
    desiredGrade
    dob
    email
    fatherEmail
    fatherJob
    fatherName
    fatherPhone
    fullName
    gender
    id
    livesWithParents
    livesWithParentsComment
    medicalNotes
    motherEmail
    motherJob
    motherName
    motherPhone
    motivation
    owner
    parentEmail
    parentName
    parentPhone
    phone
    socialAssistance
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdateStudentApplicationMutationVariables,
  APITypes.UpdateStudentApplicationMutation
>;
export const updateUserProfile = /* GraphQL */ `mutation UpdateUserProfile(
  $condition: ModelUserProfileConditionInput
  $input: UpdateUserProfileInput!
) {
  updateUserProfile(condition: $condition, input: $input) {
    archivedAt
    completedAt
    createdAt
    deactivatedAt
    displayName
    lastReviewedAt
    legalName
    notes
    phoneNumbers
    pk
    preferredName
    primaryEmail
    primaryEmailLower
    secondaryEmails
    sk
    status
    student {
      comments
      dateOfBirth
      fatherEmail
      fatherName
      fatherPhone
      fatherProfession
      fullName
      healthNotes
      homeAddress
      homeCity
      livesWithBothParents
      motherEmail
      motherName
      motherPhone
      motherProfession
      receivesSocialAssistance
      __typename
    }
    tags
    updatedAt
    updatedByEmail
    updatedBySub
    userId
    userType
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdateUserProfileMutationVariables,
  APITypes.UpdateUserProfileMutation
>;
export const updateUserRoleAssignment = /* GraphQL */ `mutation UpdateUserRoleAssignment(
  $condition: ModelUserRoleAssignmentConditionInput
  $input: UpdateUserRoleAssignmentInput!
) {
  updateUserRoleAssignment(condition: $condition, input: $input) {
    cognitoSub
    createdAt
    id
    notes
    primaryEmail
    primaryEmailLower
    roles
    updatedAt
    updatedByEmail
    updatedBySub
    verifiedEmails
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdateUserRoleAssignmentMutationVariables,
  APITypes.UpdateUserRoleAssignmentMutation
>;
export const updateWorkApplication = /* GraphQL */ `mutation UpdateWorkApplication(
  $condition: ModelWorkApplicationConditionInput
  $input: UpdateWorkApplicationInput!
) {
  updateWorkApplication(condition: $condition, input: $input) {
    comments
    coverLetter
    createdAt
    email
    fullName
    id
    owner
    phone
    position
    resumeKey
    updatedAt
    __typename
  }
}
` as GeneratedMutation<
  APITypes.UpdateWorkApplicationMutationVariables,
  APITypes.UpdateWorkApplicationMutation
>;
