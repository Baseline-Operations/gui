import { Logger } from "./logger.js";

export interface ProgressOptions {
	total: number;
	label?: string;
	showPercentage?: boolean;
}

/**
 * Utility class for displaying progress information for long operations.
 */
export class ProgressUtil {
	/**
	 * Logs progress for an operation.
	 * @param current Current progress (0-based)
	 * @param total Total items
	 * @param label Optional label for the operation
	 * @param showPercentage Whether to show percentage
	 */
	static log(
		current: number,
		total: number,
		label?: string,
		showPercentage: boolean = true
	): void {
		const percentage =
			total > 0 ? Math.round((current / total) * 100) : 0;
		const prefix = label ? `${label}: ` : "";
		const percentageText = showPercentage ? ` (${percentage}%)` : "";

		Logger.log(`${prefix}${current}/${total}${percentageText}`);
	}

	/**
	 * Creates a progress callback for use in loops.
	 * @param total Total items
	 * @param label Optional label
	 * @returns A function that logs progress when called with current index
	 */
	static createCallback(
		total: number,
		label?: string
	): (current: number) => void {
		return (current: number) => {
			this.log(current, total, label);
		};
	}

	/**
	 * Logs a simple spinner-style progress indicator.
	 * @param current Current progress (0-based)
	 * @param total Total items
	 * @param label Optional label
	 */
	static spinner(current: number, total: number, label?: string): void {
		const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
		const frame = frames[current % frames.length];
		const percentage =
			total > 0 ? Math.round((current / total) * 100) : 0;
		const prefix = label ? `${label} ` : "";
		const text = `${prefix}${frame} ${current}/${total} (${percentage}%)`;

		// Use \r to overwrite the same line
		process.stdout.write(`\r${text}`);
		if (current >= total) {
			process.stdout.write("\n");
		}
	}

	/**
	 * Creates a simple progress bar visualization.
	 * @param current Current progress (0-based)
	 * @param total Total items
	 * @param width Bar width in characters (default: 20)
	 * @returns Progress bar string
	 */
	static bar(
		current: number,
		total: number,
		width: number = 20
	): string {
		const percentage = total > 0 ? current / total : 0;
		const filled = Math.round(width * percentage);
		const empty = width - filled;

		return `[${"█".repeat(filled)}${"░".repeat(empty)}] ${Math.round(percentage * 100)}%`;
	}

	/**
	 * Logs a progress bar with label.
	 * @param current Current progress (0-based)
	 * @param total Total items
	 * @param label Optional label
	 * @param width Bar width (default: 20)
	 */
	static logBar(
		current: number,
		total: number,
		label?: string,
		width: number = 20
	): void {
		const bar = this.bar(current, total, width);
		const prefix = label ? `${label} ` : "";
		Logger.log(`${prefix}${bar} ${current}/${total}`);
	}
}
