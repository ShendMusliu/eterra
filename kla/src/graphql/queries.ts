/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

import * as APITypes from "./API";
type GeneratedQuery<InputType, OutputType> = string & {
  __generatedQueryInput: InputType;
  __generatedQueryOutput: OutputType;
};

export const getCognitoSyncState = /* GraphQL */ `query GetCognitoSyncState($id: String!) {
  getCognitoSyncState(id: $id) {
    createdAt
    id
    lastRunAt
    updatedAt
    updatedByEmail
    updatedBySub
    __typename
  }
}
` as GeneratedQuery<
  APITypes.GetCognitoSyncStateQueryVariables,
  APITypes.GetCognitoSyncStateQuery
>;
export const getDashboardPreference = /* GraphQL */ `query GetDashboardPreference($owner: String!) {
  getDashboardPreference(owner: $owner) {
    createdAt
    favoriteFeatureKeys
    owner
    updatedAt
    __typename
  }
}
` as GeneratedQuery<
  APITypes.GetDashboardPreferenceQueryVariables,
  APITypes.GetDashboardPreferenceQuery
>;
export const getDeviceLoanEvent = /* GraphQL */ `query GetDeviceLoanEvent($id: ID!) {
  getDeviceLoanEvent(id: $id) {
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
` as GeneratedQuery<
  APITypes.GetDeviceLoanEventQueryVariables,
  APITypes.GetDeviceLoanEventQuery
>;
export const getDeviceLoanRequest = /* GraphQL */ `query GetDeviceLoanRequest($id: ID!) {
  getDeviceLoanRequest(id: $id) {
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
` as GeneratedQuery<
  APITypes.GetDeviceLoanRequestQueryVariables,
  APITypes.GetDeviceLoanRequestQuery
>;
export const getReservation = /* GraphQL */ `query GetReservation($date: AWSDate!, $hour: Int!) {
  getReservation(date: $date, hour: $hour) {
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
` as GeneratedQuery<
  APITypes.GetReservationQueryVariables,
  APITypes.GetReservationQuery
>;
export const getStudentApplication = /* GraphQL */ `query GetStudentApplication($id: ID!) {
  getStudentApplication(id: $id) {
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
` as GeneratedQuery<
  APITypes.GetStudentApplicationQueryVariables,
  APITypes.GetStudentApplicationQuery
>;
export const getUserProfile = /* GraphQL */ `query GetUserProfile($pk: String!, $sk: String!) {
  getUserProfile(pk: $pk, sk: $sk) {
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
` as GeneratedQuery<
  APITypes.GetUserProfileQueryVariables,
  APITypes.GetUserProfileQuery
>;
export const getUserProfileByUserId = /* GraphQL */ `query GetUserProfileByUserId(
  $filter: ModelUserProfileFilterInput
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
  $userId: ID!
) {
  getUserProfileByUserId(
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
    userId: $userId
  ) {
    items {
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
      tags
      updatedAt
      updatedByEmail
      updatedBySub
      userId
      userType
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.GetUserProfileByUserIdQueryVariables,
  APITypes.GetUserProfileByUserIdQuery
>;
export const getUserRoleAssignment = /* GraphQL */ `query GetUserRoleAssignment($id: ID!) {
  getUserRoleAssignment(id: $id) {
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
` as GeneratedQuery<
  APITypes.GetUserRoleAssignmentQueryVariables,
  APITypes.GetUserRoleAssignmentQuery
>;
export const getWorkApplication = /* GraphQL */ `query GetWorkApplication($id: ID!) {
  getWorkApplication(id: $id) {
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
` as GeneratedQuery<
  APITypes.GetWorkApplicationQueryVariables,
  APITypes.GetWorkApplicationQuery
>;
export const listCognitoSyncStates = /* GraphQL */ `query ListCognitoSyncStates(
  $filter: ModelCognitoSyncStateFilterInput
  $id: String
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
) {
  listCognitoSyncStates(
    filter: $filter
    id: $id
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
  ) {
    items {
      createdAt
      id
      lastRunAt
      updatedAt
      updatedByEmail
      updatedBySub
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListCognitoSyncStatesQueryVariables,
  APITypes.ListCognitoSyncStatesQuery
>;
export const listDashboardPreferences = /* GraphQL */ `query ListDashboardPreferences(
  $filter: ModelDashboardPreferenceFilterInput
  $limit: Int
  $nextToken: String
  $owner: String
  $sortDirection: ModelSortDirection
) {
  listDashboardPreferences(
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    owner: $owner
    sortDirection: $sortDirection
  ) {
    items {
      createdAt
      favoriteFeatureKeys
      owner
      updatedAt
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListDashboardPreferencesQueryVariables,
  APITypes.ListDashboardPreferencesQuery
>;
export const listDeviceLoanEvents = /* GraphQL */ `query ListDeviceLoanEvents(
  $filter: ModelDeviceLoanEventFilterInput
  $limit: Int
  $nextToken: String
) {
  listDeviceLoanEvents(filter: $filter, limit: $limit, nextToken: $nextToken) {
    items {
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
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListDeviceLoanEventsQueryVariables,
  APITypes.ListDeviceLoanEventsQuery
>;
export const listDeviceLoanRequests = /* GraphQL */ `query ListDeviceLoanRequests(
  $filter: ModelDeviceLoanRequestFilterInput
  $limit: Int
  $nextToken: String
) {
  listDeviceLoanRequests(
    filter: $filter
    limit: $limit
    nextToken: $nextToken
  ) {
    items {
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
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListDeviceLoanRequestsQueryVariables,
  APITypes.ListDeviceLoanRequestsQuery
>;
export const listReservations = /* GraphQL */ `query ListReservations(
  $date: AWSDate
  $filter: ModelReservationFilterInput
  $hour: ModelIntKeyConditionInput
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
) {
  listReservations(
    date: $date
    filter: $filter
    hour: $hour
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
  ) {
    items {
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
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListReservationsQueryVariables,
  APITypes.ListReservationsQuery
>;
export const listReservedHours = /* GraphQL */ `query ListReservedHours($date: AWSDate!) {
  listReservedHours(date: $date)
}
` as GeneratedQuery<
  APITypes.ListReservedHoursQueryVariables,
  APITypes.ListReservedHoursQuery
>;
export const listStudentApplications = /* GraphQL */ `query ListStudentApplications(
  $filter: ModelStudentApplicationFilterInput
  $limit: Int
  $nextToken: String
) {
  listStudentApplications(
    filter: $filter
    limit: $limit
    nextToken: $nextToken
  ) {
    items {
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
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListStudentApplicationsQueryVariables,
  APITypes.ListStudentApplicationsQuery
>;
export const listUserProfiles = /* GraphQL */ `query ListUserProfiles(
  $filter: ModelUserProfileFilterInput
  $limit: Int
  $nextToken: String
  $pk: String
  $sk: ModelStringKeyConditionInput
  $sortDirection: ModelSortDirection
) {
  listUserProfiles(
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    pk: $pk
    sk: $sk
    sortDirection: $sortDirection
  ) {
    items {
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
      tags
      updatedAt
      updatedByEmail
      updatedBySub
      userId
      userType
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListUserProfilesQueryVariables,
  APITypes.ListUserProfilesQuery
>;
export const listUserProfilesByPrimaryEmailLower = /* GraphQL */ `query ListUserProfilesByPrimaryEmailLower(
  $filter: ModelUserProfileFilterInput
  $limit: Int
  $nextToken: String
  $primaryEmailLower: String!
  $sortDirection: ModelSortDirection
) {
  listUserProfilesByPrimaryEmailLower(
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    primaryEmailLower: $primaryEmailLower
    sortDirection: $sortDirection
  ) {
    items {
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
      tags
      updatedAt
      updatedByEmail
      updatedBySub
      userId
      userType
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListUserProfilesByPrimaryEmailLowerQueryVariables,
  APITypes.ListUserProfilesByPrimaryEmailLowerQuery
>;
export const listUserProfilesByUserType = /* GraphQL */ `query ListUserProfilesByUserType(
  $filter: ModelUserProfileFilterInput
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
  $userType: UserType!
) {
  listUserProfilesByUserType(
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
    userType: $userType
  ) {
    items {
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
      tags
      updatedAt
      updatedByEmail
      updatedBySub
      userId
      userType
      __typename
    }
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListUserProfilesByUserTypeQueryVariables,
  APITypes.ListUserProfilesByUserTypeQuery
>;
export const listUserRoleAssignments = /* GraphQL */ `query ListUserRoleAssignments(
  $filter: ModelUserRoleAssignmentFilterInput
  $id: ID
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
) {
  listUserRoleAssignments(
    filter: $filter
    id: $id
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
  ) {
    items {
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
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListUserRoleAssignmentsQueryVariables,
  APITypes.ListUserRoleAssignmentsQuery
>;
export const listUserRoleAssignmentsByCognitoSub = /* GraphQL */ `query ListUserRoleAssignmentsByCognitoSub(
  $cognitoSub: String!
  $filter: ModelUserRoleAssignmentFilterInput
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
) {
  listUserRoleAssignmentsByCognitoSub(
    cognitoSub: $cognitoSub
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
  ) {
    items {
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
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListUserRoleAssignmentsByCognitoSubQueryVariables,
  APITypes.ListUserRoleAssignmentsByCognitoSubQuery
>;
export const listUserRoleAssignmentsByPrimaryEmailLower = /* GraphQL */ `query ListUserRoleAssignmentsByPrimaryEmailLower(
  $filter: ModelUserRoleAssignmentFilterInput
  $limit: Int
  $nextToken: String
  $primaryEmailLower: String!
  $sortDirection: ModelSortDirection
) {
  listUserRoleAssignmentsByPrimaryEmailLower(
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    primaryEmailLower: $primaryEmailLower
    sortDirection: $sortDirection
  ) {
    items {
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
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListUserRoleAssignmentsByPrimaryEmailLowerQueryVariables,
  APITypes.ListUserRoleAssignmentsByPrimaryEmailLowerQuery
>;
export const listWorkApplications = /* GraphQL */ `query ListWorkApplications(
  $filter: ModelWorkApplicationFilterInput
  $limit: Int
  $nextToken: String
) {
  listWorkApplications(filter: $filter, limit: $limit, nextToken: $nextToken) {
    items {
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
    nextToken
    __typename
  }
}
` as GeneratedQuery<
  APITypes.ListWorkApplicationsQueryVariables,
  APITypes.ListWorkApplicationsQuery
>;
