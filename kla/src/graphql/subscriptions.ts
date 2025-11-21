/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "./API";
type GeneratedSubscription<InputType, OutputType> = string & {
  __generatedSubscriptionInput: InputType;
  __generatedSubscriptionOutput: OutputType;
};

export const onCreateCognitoSyncState = /* GraphQL */ `subscription OnCreateCognitoSyncState(
  $filter: ModelSubscriptionCognitoSyncStateFilterInput
) {
  onCreateCognitoSyncState(filter: $filter) {
    createdAt
    id
    lastRunAt
    updatedAt
    updatedByEmail
    updatedBySub
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnCreateCognitoSyncStateSubscriptionVariables,
  APITypes.OnCreateCognitoSyncStateSubscription
>;
export const onCreateDashboardPreference = /* GraphQL */ `subscription OnCreateDashboardPreference(
  $filter: ModelSubscriptionDashboardPreferenceFilterInput
  $owner: String
) {
  onCreateDashboardPreference(filter: $filter, owner: $owner) {
    createdAt
    favoriteFeatureKeys
    owner
    updatedAt
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnCreateDashboardPreferenceSubscriptionVariables,
  APITypes.OnCreateDashboardPreferenceSubscription
>;
export const onCreateDeviceLoanEvent = /* GraphQL */ `subscription OnCreateDeviceLoanEvent(
  $filter: ModelSubscriptionDeviceLoanEventFilterInput
  $owner: String
) {
  onCreateDeviceLoanEvent(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnCreateDeviceLoanEventSubscriptionVariables,
  APITypes.OnCreateDeviceLoanEventSubscription
>;
export const onCreateDeviceLoanRequest = /* GraphQL */ `subscription OnCreateDeviceLoanRequest(
  $filter: ModelSubscriptionDeviceLoanRequestFilterInput
  $owner: String
) {
  onCreateDeviceLoanRequest(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnCreateDeviceLoanRequestSubscriptionVariables,
  APITypes.OnCreateDeviceLoanRequestSubscription
>;
export const onCreateReservation = /* GraphQL */ `subscription OnCreateReservation(
  $filter: ModelSubscriptionReservationFilterInput
  $owner: String
) {
  onCreateReservation(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnCreateReservationSubscriptionVariables,
  APITypes.OnCreateReservationSubscription
>;
export const onCreateStudentApplication = /* GraphQL */ `subscription OnCreateStudentApplication(
  $filter: ModelSubscriptionStudentApplicationFilterInput
  $owner: String
) {
  onCreateStudentApplication(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnCreateStudentApplicationSubscriptionVariables,
  APITypes.OnCreateStudentApplicationSubscription
>;
export const onCreateUserProfile = /* GraphQL */ `subscription OnCreateUserProfile(
  $filter: ModelSubscriptionUserProfileFilterInput
) {
  onCreateUserProfile(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnCreateUserProfileSubscriptionVariables,
  APITypes.OnCreateUserProfileSubscription
>;
export const onCreateUserRoleAssignment = /* GraphQL */ `subscription OnCreateUserRoleAssignment(
  $filter: ModelSubscriptionUserRoleAssignmentFilterInput
) {
  onCreateUserRoleAssignment(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnCreateUserRoleAssignmentSubscriptionVariables,
  APITypes.OnCreateUserRoleAssignmentSubscription
>;
export const onCreateWorkApplication = /* GraphQL */ `subscription OnCreateWorkApplication(
  $filter: ModelSubscriptionWorkApplicationFilterInput
  $owner: String
) {
  onCreateWorkApplication(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnCreateWorkApplicationSubscriptionVariables,
  APITypes.OnCreateWorkApplicationSubscription
>;
export const onDeleteCognitoSyncState = /* GraphQL */ `subscription OnDeleteCognitoSyncState(
  $filter: ModelSubscriptionCognitoSyncStateFilterInput
) {
  onDeleteCognitoSyncState(filter: $filter) {
    createdAt
    id
    lastRunAt
    updatedAt
    updatedByEmail
    updatedBySub
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnDeleteCognitoSyncStateSubscriptionVariables,
  APITypes.OnDeleteCognitoSyncStateSubscription
>;
export const onDeleteDashboardPreference = /* GraphQL */ `subscription OnDeleteDashboardPreference(
  $filter: ModelSubscriptionDashboardPreferenceFilterInput
  $owner: String
) {
  onDeleteDashboardPreference(filter: $filter, owner: $owner) {
    createdAt
    favoriteFeatureKeys
    owner
    updatedAt
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnDeleteDashboardPreferenceSubscriptionVariables,
  APITypes.OnDeleteDashboardPreferenceSubscription
>;
export const onDeleteDeviceLoanEvent = /* GraphQL */ `subscription OnDeleteDeviceLoanEvent(
  $filter: ModelSubscriptionDeviceLoanEventFilterInput
  $owner: String
) {
  onDeleteDeviceLoanEvent(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteDeviceLoanEventSubscriptionVariables,
  APITypes.OnDeleteDeviceLoanEventSubscription
>;
export const onDeleteDeviceLoanRequest = /* GraphQL */ `subscription OnDeleteDeviceLoanRequest(
  $filter: ModelSubscriptionDeviceLoanRequestFilterInput
  $owner: String
) {
  onDeleteDeviceLoanRequest(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteDeviceLoanRequestSubscriptionVariables,
  APITypes.OnDeleteDeviceLoanRequestSubscription
>;
export const onDeleteReservation = /* GraphQL */ `subscription OnDeleteReservation(
  $filter: ModelSubscriptionReservationFilterInput
  $owner: String
) {
  onDeleteReservation(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteReservationSubscriptionVariables,
  APITypes.OnDeleteReservationSubscription
>;
export const onDeleteStudentApplication = /* GraphQL */ `subscription OnDeleteStudentApplication(
  $filter: ModelSubscriptionStudentApplicationFilterInput
  $owner: String
) {
  onDeleteStudentApplication(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteStudentApplicationSubscriptionVariables,
  APITypes.OnDeleteStudentApplicationSubscription
>;
export const onDeleteUserProfile = /* GraphQL */ `subscription OnDeleteUserProfile(
  $filter: ModelSubscriptionUserProfileFilterInput
) {
  onDeleteUserProfile(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteUserProfileSubscriptionVariables,
  APITypes.OnDeleteUserProfileSubscription
>;
export const onDeleteUserRoleAssignment = /* GraphQL */ `subscription OnDeleteUserRoleAssignment(
  $filter: ModelSubscriptionUserRoleAssignmentFilterInput
) {
  onDeleteUserRoleAssignment(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteUserRoleAssignmentSubscriptionVariables,
  APITypes.OnDeleteUserRoleAssignmentSubscription
>;
export const onDeleteWorkApplication = /* GraphQL */ `subscription OnDeleteWorkApplication(
  $filter: ModelSubscriptionWorkApplicationFilterInput
  $owner: String
) {
  onDeleteWorkApplication(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnDeleteWorkApplicationSubscriptionVariables,
  APITypes.OnDeleteWorkApplicationSubscription
>;
export const onUpdateCognitoSyncState = /* GraphQL */ `subscription OnUpdateCognitoSyncState(
  $filter: ModelSubscriptionCognitoSyncStateFilterInput
) {
  onUpdateCognitoSyncState(filter: $filter) {
    createdAt
    id
    lastRunAt
    updatedAt
    updatedByEmail
    updatedBySub
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnUpdateCognitoSyncStateSubscriptionVariables,
  APITypes.OnUpdateCognitoSyncStateSubscription
>;
export const onUpdateDashboardPreference = /* GraphQL */ `subscription OnUpdateDashboardPreference(
  $filter: ModelSubscriptionDashboardPreferenceFilterInput
  $owner: String
) {
  onUpdateDashboardPreference(filter: $filter, owner: $owner) {
    createdAt
    favoriteFeatureKeys
    owner
    updatedAt
    __typename
  }
}
` as GeneratedSubscription<
  APITypes.OnUpdateDashboardPreferenceSubscriptionVariables,
  APITypes.OnUpdateDashboardPreferenceSubscription
>;
export const onUpdateDeviceLoanEvent = /* GraphQL */ `subscription OnUpdateDeviceLoanEvent(
  $filter: ModelSubscriptionDeviceLoanEventFilterInput
  $owner: String
) {
  onUpdateDeviceLoanEvent(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateDeviceLoanEventSubscriptionVariables,
  APITypes.OnUpdateDeviceLoanEventSubscription
>;
export const onUpdateDeviceLoanRequest = /* GraphQL */ `subscription OnUpdateDeviceLoanRequest(
  $filter: ModelSubscriptionDeviceLoanRequestFilterInput
  $owner: String
) {
  onUpdateDeviceLoanRequest(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateDeviceLoanRequestSubscriptionVariables,
  APITypes.OnUpdateDeviceLoanRequestSubscription
>;
export const onUpdateReservation = /* GraphQL */ `subscription OnUpdateReservation(
  $filter: ModelSubscriptionReservationFilterInput
  $owner: String
) {
  onUpdateReservation(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateReservationSubscriptionVariables,
  APITypes.OnUpdateReservationSubscription
>;
export const onUpdateStudentApplication = /* GraphQL */ `subscription OnUpdateStudentApplication(
  $filter: ModelSubscriptionStudentApplicationFilterInput
  $owner: String
) {
  onUpdateStudentApplication(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateStudentApplicationSubscriptionVariables,
  APITypes.OnUpdateStudentApplicationSubscription
>;
export const onUpdateUserProfile = /* GraphQL */ `subscription OnUpdateUserProfile(
  $filter: ModelSubscriptionUserProfileFilterInput
) {
  onUpdateUserProfile(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateUserProfileSubscriptionVariables,
  APITypes.OnUpdateUserProfileSubscription
>;
export const onUpdateUserRoleAssignment = /* GraphQL */ `subscription OnUpdateUserRoleAssignment(
  $filter: ModelSubscriptionUserRoleAssignmentFilterInput
) {
  onUpdateUserRoleAssignment(filter: $filter) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateUserRoleAssignmentSubscriptionVariables,
  APITypes.OnUpdateUserRoleAssignmentSubscription
>;
export const onUpdateWorkApplication = /* GraphQL */ `subscription OnUpdateWorkApplication(
  $filter: ModelSubscriptionWorkApplicationFilterInput
  $owner: String
) {
  onUpdateWorkApplication(filter: $filter, owner: $owner) {
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
` as GeneratedSubscription<
  APITypes.OnUpdateWorkApplicationSubscriptionVariables,
  APITypes.OnUpdateWorkApplicationSubscription
>;
