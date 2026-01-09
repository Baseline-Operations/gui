import chalk from "chalk";

/**
 * Logger utility for consistent, colorized output throughout the application.
 * Provides methods for different log levels with appropriate color coding.
 */
export class Logger {
	private static readonly PREFIXES = {
		info: chalk.blue("ℹ"),
		success: chalk.green("✓"),
		warn: chalk.yellow("⚠"),
		error: chalk.red("✗"),
		debug: chalk.gray("•"),
	};

	/**
	 * Log an informational message (blue)
	 * @param message - Message to log
	 */
	static info(message: string): void {
		console.log(`${this.PREFIXES.info} ${message}`);
	}

	/**
	 * Log a success message (green)
	 * @param message - Message to log
	 */
	static success(message: string): void {
		console.log(`${this.PREFIXES.success} ${message}`);
	}

	/**
	 * Log a warning message (yellow)
	 * @param message - Message to log
	 */
	static warn(message: string): void {
		console.warn(`${this.PREFIXES.warn} ${message}`);
	}

	/**
	 * Log an error message (red)
	 * @param message - Message to log
	 */
	static error(message: string): void {
		console.error(`${this.PREFIXES.error} ${chalk.red(message)}`);
	}

	/**
	 * Log a debug message (gray)
	 * @param message - Message to log
	 */
	static debug(message: string): void {
		console.log(`${this.PREFIXES.debug} ${chalk.gray(message)}`);
	}

	/**
	 * Log a plain message without formatting
	 * @param message - Message to log
	 */
	static log(message: string): void {
		console.log(message);
	}

	/**
	 * Log a title (bold cyan, with newlines)
	 * @param message - Title message
	 */
	static title(message: string): void {
		console.log(chalk.bold.cyan(`\n${message}\n`));
	}

	/**
	 * Log a section header (bold underline)
	 * @param message - Section message
	 */
	static section(message: string): void {
		console.log(chalk.bold.underline(`\n${message}`));
	}

	/**
	 * Log a dimmed message
	 * @param message - Message to log
	 */
	static dim(message: string): void {
		console.log(chalk.dim(message));
	}

	/**
	 * Log a highlighted message (bold yellow)
	 * @param message - Message to log
	 */
	static highlight(message: string): void {
		console.log(chalk.bold.yellow(message));
	}

	/**
	 * Render a table with headers and rows
	 * @param headers - Array of header strings
	 * @param rows - Array of row arrays (string or number)
	 */
	static table(headers: string[], rows: (string | number)[][]): void {
		const widths = headers.map((header, i) => {
			const colValues = rows.map((row) => String(row[i] || ""));
			return Math.max(
				header.length,
				...colValues.map((v) => v.length)
			);
		});

		const separator = `  ${chalk.gray("│")}  `;
		const headerRow =
			chalk.bold(
				headers.map((h, i) => h.padEnd(widths[i])).join(separator)
			) + "\n";
		const separatorRow =
			chalk.gray(
				"─".repeat(
					widths.reduce((a, b) => a + b, 0) +
						separator.length * (headers.length - 1)
				)
			) + "\n";
		const dataRows =
			rows
				.map((row) =>
					row
						.map((cell, i) =>
							String(cell || "").padEnd(widths[i])
						)
						.join(separator)
				)
				.join("\n") + "\n";

		console.log(headerRow + separatorRow + dataRows);
	}
}
