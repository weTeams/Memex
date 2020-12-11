import React, { PureComponent } from 'react'
import styled from 'styled-components'
import ItemBox from '@worldbrain/memex-common/lib/common-ui/components/item-box'
import ItemBoxBottom from '@worldbrain/memex-common/lib/common-ui/components/item-box-bottom'

import * as icons from 'src/common-ui/components/design-library/icons'
import { NoteData, NoteResult, NoteInteractionProps } from '../types'

export interface Props extends NoteData, NoteResult, NoteInteractionProps {
    isShared?: boolean
    hasTags?: boolean
}

export default class NoteResultView extends PureComponent<Props> {
    private renderComment() {
        if (!this.props.comment) {
            return null
        }

        if (this.props.isEditing) {
            return (
                <NoteCommentContainer>
                    <NoteCommentEditInput
                        onChange={this.props.onCommentChange}
                        value={this.props.editNoteForm.inputValue}
                    />
                </NoteCommentContainer>
            )
        }

        return (
            <NoteCommentContainer>
                <NoteComment>{this.props.highlight}</NoteComment>
                <NoteCommentEditBtn onClick={this.props.onEditBtnClick}>
                    X
                </NoteCommentEditBtn>
            </NoteCommentContainer>
        )
    }

    private renderHighlight() {
        if (!this.props.highlight) {
            return null
        }

        return <NoteHighlight>{this.props.highlight}</NoteHighlight>
    }

    render() {
        return (
            <ItemBox>
                <StyledNoteResult>
                    <NoteContentBox>
                        {this.renderHighlight()}
                        {this.renderComment()}
                    </NoteContentBox>

                    <ItemBoxBottom
                        creationInfo={{ createdWhen: this.props.displayTime }}
                        actions={[
                            {
                                key: 'copy-paste-note-btn',
                                image: icons.copy,
                                onClick: this.props.onCopyPasterBtnClick,
                            },
                            {
                                key: 'delete-note-btn',
                                image: icons.trash,
                                onClick: this.props.onTrashBtnClick,
                            },
                            {
                                key: 'share-note-btn',
                                image: this.props.isShared
                                    ? icons.shared
                                    : icons.shareEmpty,
                                onClick: this.props.onShareBtnClick,
                            },
                            {
                                key: 'tag-note-btn',
                                image: this.props.hasTags
                                    ? icons.tagFull
                                    : icons.tagEmpty,
                                onClick: this.props.onTagPickerBtnClick,
                            },
                            {
                                key: 'reply-to-note-btn',
                                image: icons.commentAdd,
                                onClick: this.props.onReplyBtnClick,
                            },
                            {
                                key: 'bookmark-note-btn',
                                image: this.props.isBookmarked
                                    ? icons.heartFull
                                    : icons.heartEmpty,
                                onClick: this.props.onBookmarkBtnClick,
                            },
                        ]}
                    />
                </StyledNoteResult>
            </ItemBox>
        )
    }
}

const StyledNoteResult = styled.div`
    display: flex;
`

const NoteContentBox = styled.div``

const NoteHighlight = styled.span``
const NoteCommentContainer = styled.div``
const NoteCommentEditBtn = styled.button``
const NoteCommentEditActionBtn = styled.button``
const NoteComment = styled.span``
const NoteCommentEditInput = styled.textarea``