/*
 * Copyright (c) 2022 pikokr. Licensed under the MIT license
 */

import {
  ApplicationCommandSubCommandData,
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  InteractionEditReplyOptions,
  Message,
  MessageEditOptions,
  MessagePayload,
  User,
} from 'discord.js'

export type UpdateMessageFn = (
  payload: InteractionEditReplyOptions | MessageEditOptions,
) => Promise<unknown>

export abstract class JejudoCommand {
  protected constructor(
    public data: ApplicationCommandSubCommandData,
    public textCommandAliases: string[] = [],
  ) {}

  async autocomplete(i: AutocompleteInteraction) {
    await i.respond([])
  }

  abstract execute(
    msg: Message,
    args: string,
    updateReference: UpdateMessageFn,
    author: User,
    reference: Message | ChatInputCommandInteraction,
  ): Promise<void>
}
