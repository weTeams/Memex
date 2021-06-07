import { PersonalCloudUpdatePushBatch } from './backend/types'

export type PersonalCloudAction = PushObjectAction
export enum PersonalCloudActionType {
    PushObject = 'push-object',
}
export interface PushObjectAction {
    type: PersonalCloudActionType.PushObject
    updates: PersonalCloudUpdatePushBatch
}

export interface PersonalCloudSettings {
    deviceId?: PersonalCloudDeviceID
}
export type PersonalCloudDeviceID = number | string