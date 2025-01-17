import debounce from 'lodash/debounce'
import { UILogic, UIEvent, UIEventHandler, UIMutation } from 'ui-logic-core'
import type { KeyEvent } from 'src/common-ui/GenericPicker/types'
import type { RemoteCollectionsInterface } from 'src/custom-lists/background/types'
import type { ContentSharingInterface } from 'src/content-sharing/background/types'
import { validateListName } from '../utils'

export interface SpaceDisplayEntry {
    localId: number
    remoteId: string | number | null
    name: string
    focused: boolean
    createdAt: number
}

export interface SpacePickerDependencies {
    createNewEntry: (name: string) => Promise<number>
    selectEntry: (
        listId: number,
        options?: { protectAnnotation?: boolean },
    ) => Promise<void>
    unselectEntry: (listId: number) => Promise<void>
    actOnAllTabs?: (listId: number) => Promise<void>
    onEscapeKeyDown?: () => void | Promise<void>
    /** Called when user keys Enter+Cmd/Ctrl in main text input */
    onSubmit?: () => void | Promise<void>
    initialSelectedEntries?: () => number[] | Promise<number[]>
    children?: any
    onClickOutside?: React.MouseEventHandler
    spacesBG: RemoteCollectionsInterface
    contentSharingBG: ContentSharingInterface
}

export type SpacePickerEvent = UIEvent<{
    setSearchInputRef: { ref: HTMLInputElement }
    searchInputChanged: { query: string }
    selectedEntryPress: { entry: number }
    resultEntryAllPress: { entry: SpaceDisplayEntry }
    newEntryAllPress: { entry: string }
    resultEntryPress: { entry: SpaceDisplayEntry }
    resultEntryFocus: { entry: SpaceDisplayEntry; index: number }
    newEntryPress: { entry: string }
    keyPress: { event: KeyboardEvent }
    focusInput: {}
}>

type EventHandler<EventName extends keyof SpacePickerEvent> = UIEventHandler<
    SpacePickerState,
    SpacePickerEvent,
    EventName
>

export interface SpacePickerState {
    query?: string
    newEntryName: string
    displayEntries: SpaceDisplayEntry[]
    selectedEntries: number[]
    loadingSuggestions: boolean
    loadingQueryResults: boolean
}

export default class SpacePickerLogic extends UILogic<
    SpacePickerState,
    SpacePickerEvent
> {
    private searchInputRef?: HTMLInputElement
    private newTabKeys: KeyEvent[] = ['Enter', ',', 'Tab']

    constructor(protected dependencies: SpacePickerDependencies) {
        super()
    }

    public defaultEntries: SpaceDisplayEntry[] = []
    private focusIndex = -1

    // For now, the only thing that needs to know if this has finished, is the tests.
    private _processingUpstreamOperation: Promise<void>

    get processingUpstreamOperation() {
        return this._processingUpstreamOperation
    }
    set processingUpstreamOperation(val) {
        this._processingUpstreamOperation = val
    }

    getInitialState(): SpacePickerState {
        return {
            query: '',
            newEntryName: '',
            displayEntries: [],
            selectedEntries: [],
            loadingSuggestions: false,
            loadingQueryResults: false,
        } as SpacePickerState
    }

    init: EventHandler<'init'> = async () => {
        this.emitMutation({
            $apply: (state) => ({ ...state, loadingSuggestions: true }),
        })

        const initialSelectedEntries = this.dependencies.initialSelectedEntries
            ? await this.dependencies.initialSelectedEntries()
            : []

        const defaultSuggestions = await this.loadDefaultSuggestions(
            initialSelectedEntries,
        )

        this.defaultEntries = defaultSuggestions

        this.emitMutation({
            $apply: (state) => ({
                ...state,
                loadingSuggestions: false,
                displayEntries: this.defaultEntries,
                selectedEntries: initialSelectedEntries,
            }),
        })
    }

    private async loadDefaultSuggestions(
        selectedEntries: number[],
    ): Promise<SpaceDisplayEntry[]> {
        const { spacesBG: collectionsBG, contentSharingBG } = this.dependencies
        const suggestions = await collectionsBG.fetchInitialListSuggestions()
        const remoteListIds = await contentSharingBG.getRemoteListIds({
            localListIds: suggestions.map((s) => s.localId as number),
        })

        return (
            suggestions
                // Sort with the selected entries first
                .sort(
                    (a, b) =>
                        (selectedEntries.includes(b.localId) ? 1 : 0) -
                        (selectedEntries.includes(a.localId) ? 1 : 0),
                )
                .map((s) => ({
                    ...s,
                    remoteId: remoteListIds[s.localId] ?? null,
                }))
        )
    }

    setSearchInputRef: EventHandler<'setSearchInputRef'> = ({
        event: { ref },
        previousState,
    }) => {
        this.searchInputRef = ref
    }

    focusInput: EventHandler<'focusInput'> = () => {
        this.searchInputRef?.focus()
    }

    keyPress: EventHandler<'keyPress'> = async ({
        event: { event },
        previousState,
    }) => {
        if (
            event.key === 'Enter' &&
            event.metaKey &&
            this.dependencies.onSubmit
        ) {
            await this.dependencies.onSubmit()
            return
        }

        if (this.newTabKeys.includes(event.key as KeyEvent)) {
            if (previousState.newEntryName !== '' && !(this.focusIndex >= 0)) {
                await this.newEntryPress({
                    previousState,
                    event: { entry: previousState.newEntryName },
                })
                return
            }

            if (previousState.displayEntries[this.focusIndex]) {
                await this.resultEntryPress({
                    event: {
                        entry: previousState.displayEntries[this.focusIndex],
                    },
                    previousState,
                })
                return
            }
        }

        if (event.key === 'ArrowUp') {
            if (this.focusIndex > -1) {
                this._updateFocus(
                    --this.focusIndex,
                    previousState.displayEntries,
                )
                return
            }
        }

        if (event.key === 'ArrowDown') {
            if (this.focusIndex < previousState.displayEntries.length - 1) {
                this._updateFocus(
                    ++this.focusIndex,
                    previousState.displayEntries,
                )
                return
            }
        }

        if (event.key === 'Escape' && this.dependencies.onEscapeKeyDown) {
            await this.dependencies.onEscapeKeyDown()
            return
        }
    }

    searchInputChanged: EventHandler<'searchInputChanged'> = async ({
        event: { query },
    }) => {
        this.emitMutation({
            query: { $set: query },
            newEntryName: { $set: query },
        })

        if (!query || query === '') {
            this.emitMutation({ displayEntries: { $set: this.defaultEntries } })
        } else {
            return this.query(query)
        }
    }

    /**
     * Searches for the term via the `queryEntries` function provided to the component
     */
    private queryRemote = async (term: string) => {
        const { spacesBG: collectionsBG, contentSharingBG } = this.dependencies
        this.emitMutation({ loadingQueryResults: { $set: true } })

        const suggestions = await collectionsBG.searchForListSuggestions({
            query: term.toLocaleLowerCase(),
        })
        const remoteListIds = await contentSharingBG.getRemoteListIds({
            localListIds: suggestions.map((s) => s.id),
        })
        const displayEntries = suggestions
            .map((s) => ({
                localId: s.id,
                name: s.name,
                createdAt: s.createdAt,
                focused: false,
                remoteId: remoteListIds[s.id] ?? null,
            }))
            .sort()

        this.emitMutation({
            loadingQueryResults: { $set: false },
            displayEntries: { $set: displayEntries },
        })
        this._setCreateEntryDisplay(displayEntries, displayEntries, term)
    }

    private query = debounce(this.queryRemote, 150, { leading: true })

    /**
     * If the term provided does not exist in the entry list, then set the new entry state to the term.
     * (controls the 'Add a new Tag: ...')
     */
    private _setCreateEntryDisplay = (
        list: SpaceDisplayEntry[],
        displayEntries: SpaceDisplayEntry[],
        term: string,
    ) => {
        if (this._isTermInEntryList(list, term)) {
            this.emitMutation({ newEntryName: { $set: '' } })
            // N.B. We update this focus index to this found entry, so that
            // enter keys will action it. But we don't emit that focus
            // to the user, because otherwise the style of the button changes
            // showing the tick and it might seem like it's already selected.
            this._updateFocus(0, displayEntries, false)
        } else {
            let entry: string
            try {
                entry = this.validateEntry(term)
            } catch (e) {
                return
            }
            this.emitMutation({ newEntryName: { $set: entry } })
            this._updateFocus(-1, displayEntries)
        }
    }

    private _updateFocus = (
        focusIndex: number | undefined,
        displayEntries: SpaceDisplayEntry[],
        emit = true,
    ) => {
        this.focusIndex = focusIndex ?? -1
        if (!displayEntries) {
            return
        }

        for (let i = 0; i < displayEntries.length; i++) {
            displayEntries[i].focused = focusIndex === i
        }

        if (emit) {
            this.emitMutation({ displayEntries: { $set: displayEntries } })
        }
    }

    /**
     * Loops through a list of entries and exits if a match is found
     */
    private _isTermInEntryList = (
        entryList: SpaceDisplayEntry[],
        term: string,
    ) => {
        for (const entry of entryList) {
            if (entry.name === term) {
                return true
            }
        }
        return false
    }

    selectedEntryPress: EventHandler<'selectedEntryPress'> = async ({
        event: { entry },
        previousState,
    }) => {
        this.emitMutation({
            selectedEntries: {
                $set: previousState.selectedEntries.filter(
                    (id) => id !== entry,
                ),
            },
        } as UIMutation<SpacePickerState>)

        await this.dependencies.unselectEntry(entry)
    }

    resultEntryPress: EventHandler<'resultEntryPress'> = async ({
        event: { entry },
        previousState,
    }) => {
        const { unselectEntry, selectEntry } = this.dependencies

        // If we're going to unselect it
        if (previousState.selectedEntries.includes(entry.localId)) {
            this.emitMutation({
                selectedEntries: {
                    $set: previousState.selectedEntries.filter(
                        (id) => id !== entry.localId,
                    ),
                },
            })
            await unselectEntry(entry.localId)
        } else {
            const prevDisplayIndex = previousState.displayEntries.findIndex(
                ({ localId }) => localId === entry.localId,
            )

            this.emitMutation({
                selectedEntries: { $push: [entry.localId] },
                displayEntries: {
                    // Reposition selected entry at start of display list
                    $set: [
                        previousState.displayEntries[prevDisplayIndex],
                        ...previousState.displayEntries.slice(
                            0,
                            prevDisplayIndex,
                        ),
                        ...previousState.displayEntries.slice(
                            prevDisplayIndex + 1,
                        ),
                    ],
                },
            })
            await selectEntry(entry.localId)
        }
    }

    resultEntryAllPress: EventHandler<'resultEntryAllPress'> = async ({
        event: { entry },
        previousState,
    }) => {
        this._processingUpstreamOperation = this.dependencies.actOnAllTabs(
            entry.localId,
        )

        const isAlreadySelected = previousState.selectedEntries.includes(
            entry.localId,
        )

        this.emitMutation({
            selectedEntries: {
                $set: isAlreadySelected
                    ? previousState.selectedEntries.filter(
                          (entryId) => entryId !== entry.localId,
                      )
                    : [...previousState.selectedEntries, entry.localId],
            },
        } as UIMutation<SpacePickerState>)
    }

    private async createAndDisplayNewList(name: string): Promise<number> {
        const newId = await this.dependencies.createNewEntry(name)
        const newEntry: SpaceDisplayEntry = {
            name,
            localId: newId,
            focused: false,
            remoteId: null,
            createdAt: Date.now(),
        }
        this.defaultEntries.unshift(newEntry)
        this.emitMutation({
            query: { $set: '' },
            newEntryName: { $set: '' },
            selectedEntries: { $push: [newId] },
            displayEntries: {
                $set: [...this.defaultEntries],
            },
        } as UIMutation<SpacePickerState>)
        return newId
    }

    newEntryPress: EventHandler<'newEntryPress'> = async ({
        event: { entry },
    }) => {
        entry = this.validateEntry(entry)
        const listId = await this.createAndDisplayNewList(entry)
        await this.dependencies.selectEntry(listId)
    }

    newEntryAllPress: EventHandler<'newEntryAllPress'> = async ({
        event: { entry },
    }) => {
        const newId = await this.createAndDisplayNewList(entry)
        this._processingUpstreamOperation = this.dependencies.actOnAllTabs(
            newId,
        )
    }

    resultEntryFocus: EventHandler<'resultEntryFocus'> = ({
        event: { entry, index },
        previousState,
    }) => {
        this._updateFocus(index, previousState.displayEntries)
    }

    validateEntry = (entry: string) => {
        const validationResult = validateListName(
            entry,
            this.defaultEntries.map((e) => ({ id: e.localId, name: e.name })),
        )

        if (validationResult.valid === false) {
            throw Error('Space Picker Validation: ' + validationResult.reason)
        }

        return entry
    }
}
