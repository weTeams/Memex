import { TestLogicContainer } from 'ui-logic-core/lib/testing'

import { UILogicTestDevice } from 'src/tests/ui-logic-tests'
import { DashboardLogic } from './logic'
import { Events, RootState } from './types'
import * as DATA from './logic.test.data'
import {
    StandardSearchResponse,
    AnnotationsSearchResponse,
} from 'src/search/background/types'

type DataSeeder = (logic: TestLogicContainer<RootState, Events>) => void
type DataSeederCreator = (
    data?: StandardSearchResponse | AnnotationsSearchResponse,
) => DataSeeder

export const setPageSearchResult: DataSeederCreator = (
    result = DATA.PAGE_SEARCH_RESULT_1,
) => (logic) => logic.processEvent('setPageSearchResult', { result })

export const setNoteSearchResult: DataSeederCreator = (
    result: any = DATA.ANNOT_SEARCH_RESULT_2,
) => (logic) => logic.processEvent('setAnnotationSearchResult', { result })

export async function setupTest(
    device: UILogicTestDevice,
    args: { seedData?: DataSeeder } = {},
) {
    const logic = new DashboardLogic({})
    const searchResults = device.createElement<RootState, Events>(logic)

    if (args.seedData) {
        args.seedData(searchResults)
    }

    return { searchResults, logic }
}