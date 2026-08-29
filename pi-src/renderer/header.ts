import type { Theme } from "@earendil-works/pi-coding-agent";
import type { Component } from "@earendil-works/pi-tui";
import {
	CUSTOM_HEADER_ANIMATION_DURATIONS_MS,
	CUSTOM_HEADER_LOGO_FRAMES,
	renderCustomHeader,
	type CustomHeaderSnapshot,
} from "./custom-header.ts";
import type { IconGlyphs } from "./icons.ts";

export type PiTuiHeaderSnapshot = CustomHeaderSnapshot;

export function renderPiTuiHeader(
	snapshot: PiTuiHeaderSnapshot,
	width: number,
	theme: Theme,
	glyphs: IconGlyphs,
	logoFrame?: (typeof CUSTOM_HEADER_LOGO_FRAMES)[number],
): string[] {
	return renderCustomHeader(snapshot, width, theme, glyphs, logoFrame);
}

export class PiTuiHeader implements Component {
	private readonly getSnapshot: () => PiTuiHeaderSnapshot;
	private readonly getTheme: () => Theme;
	private readonly getGlyphs: () => IconGlyphs;
	private readonly requestRender: () => void;
	private animationFrame = 0;
	private animationTimer: ReturnType<typeof setTimeout> | undefined;

	constructor(
		getSnapshot: () => PiTuiHeaderSnapshot,
		getTheme: () => Theme,
		getGlyphs: () => IconGlyphs,
		requestRender: () => void = () => {},
	) {
		this.getSnapshot = getSnapshot;
		this.getTheme = getTheme;
		this.getGlyphs = getGlyphs;
		this.requestRender = requestRender;
		this.scheduleNextAnimationFrame();
	}

	private scheduleNextAnimationFrame(): void {
		if (this.animationFrame >= CUSTOM_HEADER_LOGO_FRAMES.length - 1) return;
		this.animationTimer = setTimeout(() => {
			this.animationTimer = undefined;
			this.animationFrame += 1;
			this.requestRender();
			this.scheduleNextAnimationFrame();
		}, CUSTOM_HEADER_ANIMATION_DURATIONS_MS[this.animationFrame] ?? 80);
	}

	private stopAnimation(): void {
		if (this.animationTimer) {
			clearTimeout(this.animationTimer);
			this.animationTimer = undefined;
		}
	}

	invalidate(): void {}

	render(width: number): string[] {
		return renderPiTuiHeader(
			this.getSnapshot(),
			width,
			this.getTheme(),
			this.getGlyphs(),
			CUSTOM_HEADER_LOGO_FRAMES[this.animationFrame],
		);
	}

	dispose(): void {
		this.stopAnimation();
	}
}
