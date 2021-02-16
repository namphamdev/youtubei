import { SearchResultType, SearchOptions } from "./client";
import { I_END_POINT } from "../constants";
import { axios, extendsBuiltIn, YoutubeRawData } from "../common";
import { Channel, PlaylistCompact, VideoCompact } from "..";

@extendsBuiltIn()
export default class SearchResult<T> extends Array<SearchResultType<T>> {
	private latestContinuationToken!: string;

	constructor() {
		super();
	}

	/**
	 * Initialize data from search
	 *
	 * @param query Search query
	 * @param options Search Options
	 */
	async init(query: string, options: SearchOptions): Promise<SearchResult<T>> {
		const response = await axios.post(`${I_END_POINT}/search`, {
			query,
			params: SearchResult.getSearchTypeParam(options.type),
		});

		this.load(
			response.data.contents.twoColumnSearchResultsRenderer.primaryContents
				.sectionListRenderer.contents
		);
		return this;
	}

	/**
	 * Load next search data
	 */
	async next(): Promise<Array<SearchResultType<T>>> {
		if (!this.latestContinuationToken) throw new Error("No Continuation");
		const response = await axios.post(`${I_END_POINT}/search`, {
			continuation: this.latestContinuationToken,
		});
		return this.load(
			response.data.onResponseReceivedCommands[0].appendContinuationItemsAction
				.continuationItems
		);
	}

	/**
	 * Load data from youtube
	 */
	private load(sectionListContents: YoutubeRawData): Array<SearchResultType<T>> {
		const contents = sectionListContents
			.filter((c: Record<string, unknown>) => "itemSectionRenderer" in c)
			.pop().itemSectionRenderer.contents;
		const continuationToken = sectionListContents
			.filter((c: Record<string, unknown>) => "continuationItemRenderer" in c)
			.pop().continuationItemRenderer?.continuationEndpoint?.continuationCommand.token;

		this.latestContinuationToken = continuationToken;
		const newContent = [];

		for (const content of contents) {
			if ("playlistRenderer" in content)
				newContent.push(new PlaylistCompact().load(content.playlistRenderer));
			else if ("videoRenderer" in content)
				newContent.push(new VideoCompact().load(content.videoRenderer));
			else if ("channelRenderer" in content)
				newContent.push(new Channel().load(content.channelRenderer));
		}

		this.push(...(newContent as Array<SearchResultType<T>>));
		return newContent as Array<SearchResultType<T>>;
	}

	/**
	 * Get type query value
	 *
	 * @param type Search type
	 */
	static getSearchTypeParam(type: "video" | "playlist" | "channel" | "all"): string {
		const searchType = {
			video: "EgIQAQ%3D%3D",
			playlist: "EgIQAw%3D%3D",
			channel: "EgIQAg%3D%3D",
			all: "",
		};
		return type in searchType ? searchType[type] : "";
	}
}
