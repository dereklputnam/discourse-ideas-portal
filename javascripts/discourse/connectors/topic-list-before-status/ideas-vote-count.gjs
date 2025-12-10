import Component from "@glimmer/component";
import { on } from "@ember/modifier";
import { action } from "@ember/object";
import { service } from "@ember/service";
import bodyClass from "discourse/helpers/body-class";
import concatClass from "discourse/helpers/concat-class";
import icon from "discourse/helpers/d-icon";
import { ajax } from "discourse/lib/ajax";
import { popupAjaxError } from "discourse/lib/ajax-error";
import { i18n } from "discourse-i18n";

export default class IdeasVoteCount extends Component {
  @service currentUser;
  @service discovery;
  @service site;

  get topic() {
    return this.args.outletArgs.topic;
  }

  get enabledCategories() {
    const categoriesString = settings.enabled_categories || "";
    return categoriesString.split("|").map(Number).filter(Boolean);
  }

  get showVoteCount() {
    const id = this.discovery.category?.id;

    return (
      this.site.desktopView &&
      this.topic.get("can_vote") &&
      id &&
      this.enabledCategories.some((category) => category === id)
    );
  }

  get votingDisabled() {
    return (
      (this.currentUser?.get("votes_left") <= 0 &&
        !this.topic.get("user_voted")) ||
      this.topic.get("closed") ||
      this.topic.get("unread") === undefined
    );
  }

  get votedStatus() {
    if (this.topic.get("unread") === undefined) {
      return "You must view this topic before you can vote.";
    } else if (this.topic.get("closed")) {
      return "This topic is closed. Voting is no longer allowed.";
    } else if (
      this.currentUser?.get("votes_left") <= 0 &&
      !this.topic.get("user_voted")
    ) {
      return "You are out of votes. Remove an existing vote then try again.";
    } else {
      return this.topic.get("user_voted")
        ? "You voted for this topic. Select to remove vote."
        : "Select to vote for this topic.";
    }
  }

  @action
  async vote() {
    if (
      (this.currentUser.get("votes_left") <= 0 && !this.topic.user_voted) ||
      this.topic.closed ||
      this.topic.unread === undefined
    ) {
      return;
    }

    let voteType;

    if (this.topic.user_voted) {
      this.topic.set("vote_count", this.topic.vote_count - 1);
      voteType = "unvote";

      this.currentUser.set("votes_left", this.currentUser.votes_left + 1);
      this.topic.set("user_voted", false);
    } else {
      this.topic.set("vote_count", this.topic.vote_count + 1);
      voteType = "vote";

      this.currentUser.set("votes_left", this.currentUser.votes_left - 1);
      this.topic.set("user_voted", true);
    }

    try {
      const result = await ajax(`/voting/${voteType}`, {
        type: "POST",
        data: { topic_id: this.topic.id },
      });

      this.currentUser.setProperties({
        votes_exceeded: !result.can_vote,
        votes_left: result.votes_left,
      });
    } catch (e) {
      popupAjaxError(e);
    }
  }

  <template>
    {{#if this.showVoteCount}}
      {{bodyClass "ideas-voting-category"}}

      <div class="ideas-vote-count-before-title">
        <button
          {{on "click" this.vote}}
          type="button"
          title={{this.votedStatus}}
          class={{concatClass
            "ideas-topic-list-vote-button btn-flat"
            (unless this.topic.user_voted "can-vote")
            (if this.votingDisabled "disabled")
          }}
        >{{icon "caret-up"}}</button>
        <span class="ideas-vote-count-value">{{this.topic.vote_count}}</span>
      </div>
    {{/if}}
  </template>
}
