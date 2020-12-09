import React, { PureComponent } from 'react'
import styled, { css } from 'styled-components'

import colors from 'src/dashboard-refactor/colors'
import { sizeConstants } from 'src/dashboard-refactor/constants'
import styles, { fonts } from 'src/dashboard-refactor/styles'
import { remoteFunction } from 'src/util/webextensionRPC'

import Margin from 'src/dashboard-refactor/components/Margin'
import { DatePicker, TagPicker, ListPicker, DomainPicker } from './components/'

import { SelectedState } from '../../types'
import { Props as DateRangeSelectionProps } from 'src/overview/search-bar/components/DateRangeSelection'
import { FilterPickerProps } from './components/types'
import { FilterPickerLabel } from './types'

const windowWidth: number = window.innerWidth
const searchBarWidthPx: number = sizeConstants.searchBar.widthPx
const innerContainerIndent: number = (windowWidth - searchBarWidthPx) / 2

const Container = styled.div<{ hidden: boolean }>`
    height: 30px;
    width: 100%;
    border-bottom: 1px solid ${colors.lighterGrey};
    ${(props) =>
        css`
            display: ${props.hidden ? 'none' : 'flex'};
        `};
`

const InnerContainer = styled.div`
    width: ${searchBarWidthPx}px;
    position: absolute;
    left: ${innerContainerIndent}px;
    display: flex;
    align-items: center;
    justify-content: start;
`

const FilterSelectButton = styled.div<{ selected: boolean }>`
    height: 16px;
    width: min-content;
    display: flex;
    align-items: center;
    ${(props) => css`
        background-color: ${props.selected ? colors.lightGrey : colors.white};
    `}
    border: 1px solid ${colors.lightGrey};
    border-radius: ${styles.borderRadius.medium};
`

const TextSpan = styled.span`
    font-family: ${fonts.primary.name};
    font-weight: ${fonts.primary.weight.normal};
    font-size: 10px;
    line-height: 15px;
`

export interface FiltersBarProps {
    isDisplayed: boolean
    dateFilterSelectedState: SelectedState
    domainFilterSelectedState: SelectedState
    tagFilterSelectedState: SelectedState
    listFilterSelectedState: SelectedState
    pickerProps: {
        datePickerProps?: DateRangeSelectionProps
        tagPickerProps?: FilterPickerProps
        domainPickerProps?: FilterPickerProps
        listPickerProps?: FilterPickerProps
    }
}

export default class FiltersBar extends PureComponent<FiltersBarProps> {
    private getFilteredDomains: (args: {
        query: string
    }) => Promise<string[]> = async ({ query }) => {
        const domainList: string[] = await this.getSuggestedDomains()
        const filteredDomains: string[] = domainList.filter((domain) =>
            domain.startsWith(query),
        )
        return filteredDomains
    }

    private getSuggestedDomains = async (): Promise<string[]> => {
        const suggestedDomains: Promise<string[]> = await remoteFunction(
            'extendedSuggest',
        )({
            // notInclude: domains,
            type: 'domain',
        })
        return suggestedDomains
    }

    private renderFilterSelectButton = (
        label: FilterPickerLabel,
        selectedState: SelectedState,
    ): JSX.Element => {
        const { isSelected, onSelection } = selectedState
        return (
            <Margin horizontal="7px" vertical="7px">
                <FilterSelectButton selected={isSelected} onClick={onSelection}>
                    <Margin horizontal="7px">
                        <TextSpan>{label}</TextSpan>
                    </Margin>
                </FilterSelectButton>
            </Margin>
        )
    }

    private renderDatePicker = () => {
        return <DatePicker {...this.props.pickerProps.datePickerProps} />
    }

    private renderTagPicker = () => {
        return <TagPicker {...this.props.pickerProps.tagPickerProps} />
    }

    private renderDomainPicker = () => {
        const {
            onEntriesListUpdate,
            initialSelectedEntries,
            onToggleShowPicker,
        } = this.props.pickerProps.domainPickerProps
        return (
            <DomainPicker
                onUpdateEntrySelection={onEntriesListUpdate}
                queryEntries={(query) => this.getFilteredDomains({ query })}
                loadDefaultSuggestions={this.getSuggestedDomains}
                initialSelectedEntries={async () => initialSelectedEntries}
                onEscapeKeyDown={onToggleShowPicker}
            />
        )
    }

    private renderListPicker = () => {
        return <ListPicker {...this.props.pickerProps.listPickerProps} />
    }

    render() {
        const {
            isDisplayed,
            dateFilterSelectedState,
            tagFilterSelectedState,
            domainFilterSelectedState,
            listFilterSelectedState,
        } = this.props

        return (
            <>
                <Container hidden={!isDisplayed}>
                    <InnerContainer>
                        {this.renderFilterSelectButton(
                            'Date',
                            dateFilterSelectedState,
                        )}
                        {this.renderFilterSelectButton(
                            'Domains',
                            domainFilterSelectedState,
                        )}
                        {this.renderFilterSelectButton(
                            'Tags',
                            tagFilterSelectedState,
                        )}
                        {this.renderFilterSelectButton(
                            'Lists',
                            listFilterSelectedState,
                        )}
                    </InnerContainer>
                </Container>
                <InnerContainer>
                    {dateFilterSelectedState.isSelected &&
                        this.renderDatePicker()}
                    {tagFilterSelectedState.isSelected &&
                        this.renderTagPicker()}
                    {domainFilterSelectedState.isSelected &&
                        this.renderDomainPicker()}
                    {listFilterSelectedState.isSelected &&
                        this.renderListPicker()}
                </InnerContainer>
            </>
        )
    }
}