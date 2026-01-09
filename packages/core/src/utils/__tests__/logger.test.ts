import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Logger } from "../logger.js";

describe("Logger", () => {
	beforeEach(() => {
		vi.spyOn(console, "log").mockImplementation(() => {});
		vi.spyOn(console, "warn").mockImplementation(() => {});
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should log info messages", () => {
		const spy = vi.spyOn(console, "log");
		Logger.info("Test info message");
		expect(spy).toHaveBeenCalled();
	});

	it("should log success messages", () => {
		const spy = vi.spyOn(console, "log");
		Logger.success("Test success message");
		expect(spy).toHaveBeenCalled();
	});

	it("should log warning messages", () => {
		const spy = vi.spyOn(console, "warn");
		Logger.warn("Test warning message");
		expect(spy).toHaveBeenCalled();
	});

	it("should log error messages", () => {
		const spy = vi.spyOn(console, "error");
		Logger.error("Test error message");
		expect(spy).toHaveBeenCalled();
	});

	it("should log debug messages", () => {
		const spy = vi.spyOn(console, "log");
		Logger.debug("Test debug message");
		expect(spy).toHaveBeenCalled();
	});

	it("should log plain messages", () => {
		const spy = vi.spyOn(console, "log");
		Logger.log("Test plain message");
		expect(spy).toHaveBeenCalledWith("Test plain message");
	});

	it("should log titles", () => {
		const spy = vi.spyOn(console, "log");
		Logger.title("Test Title");
		expect(spy).toHaveBeenCalled();
	});

	it("should log sections", () => {
		const spy = vi.spyOn(console, "log");
		Logger.section("Test Section");
		expect(spy).toHaveBeenCalled();
	});

	it("should log dim messages", () => {
		const spy = vi.spyOn(console, "log");
		Logger.dim("Test dim message");
		expect(spy).toHaveBeenCalled();
	});

	it("should log highlighted messages", () => {
		const spy = vi.spyOn(console, "log");
		Logger.highlight("Test highlight message");
		expect(spy).toHaveBeenCalled();
	});

	it("should render tables", () => {
		const spy = vi.spyOn(console, "log");
		const headers = ["Name", "Version"];
		const rows: (string | number)[][] = [
			["package-a", "1.0.0"],
			["package-b", "2.0.0"],
		];
		Logger.table(headers, rows);
		expect(spy).toHaveBeenCalled();
	});
});
