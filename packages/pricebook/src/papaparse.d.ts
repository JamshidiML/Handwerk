declare module "papaparse" {
  export interface ParseError {
    code: string;
    message: string;
    row?: number;
  }

  export interface ParseResult<T> {
    data: T[];
    errors: ParseError[];
    meta: {
      delimiter: string;
      linebreak: string;
      aborted: boolean;
      truncated: boolean;
    };
  }

  export interface ParseConfig {
    delimiter?: string;
    skipEmptyLines?: boolean | "greedy";
  }

  const Papa: {
    parse<T = string[]>(input: string, config?: ParseConfig): ParseResult<T>;
  };

  export default Papa;
}
