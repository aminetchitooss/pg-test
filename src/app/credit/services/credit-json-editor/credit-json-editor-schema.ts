export const CONFIG_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Query configuration',
  type: 'object',
  additionalProperties: true,
  required: ['version', 'server', 'client'],

  properties: {
    version: {
      type: 'string',
      description: 'Semantic version of the configuration file.',
    },

    /** -------------------------------------------------------
     *  SERVER SECTION
     *  ------------------------------------------------------- */
    server: {
      type: 'object',
      additionalProperties: true,
      required: ['queries'],
      properties: {
        queries: {
          type: 'object',
          additionalProperties: true,
          description: 'Arbitrary query definitions.',
        },

        row_based: {
          type: 'boolean',
        },
        max_query_duration: {
          type: 'integer',
          minimum: 0,
          description: 'Maximum allowed query run time (seconds).',
        },
        stream_response: {
          type: 'boolean',
        },
        keep_zeroes: {
          type: 'boolean',
        },
        disable_package_logic: {
          type: 'boolean',
        },
        log_level: {
          type: 'string',
          enum: ['TRACE', 'DEBUG', 'INFO', '', 'ERROR', 'FATAL'],
          description: 'Logging verbosity.',
        },
        disable_nighthawk: {
          type: 'boolean',
        },
        update_tolerance: {
          type: 'number',
          description: 'Tolerance used for incremental updates.',
        },
        column_expressions: {
          type: 'object',
          additionalProperties: {
            type: 'string',
            description: 'Expression evaluated for the column.',
          },
        },
      },
    },

    /** -------------------------------------------------------
     *  CLIENT SECTION
     *  ------------------------------------------------------- */
    client: {
      type: 'object',
      additionalProperties: true,
      properties: {
        /** Array of token-substitution definitions */
        text_substitutions: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['token', 'multi', 'description', 'substitutionElements'],
            properties: {
              token: {
                type: 'string',
                description: 'Placeholder token that can be used in server queries.',
              },
              multi: {
                type: 'boolean',
                description: 'If true the token can be selected multiple times.',
              },
              description: {
                type: 'string',
              },
              substitutionElements: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['displayName', 'substitutionText'],
                  properties: {
                    displayName: {
                      type: 'string',
                      description: 'Human-readable name shown in UI.',
                    },
                    substitutionText: {
                      type: 'string',
                      description: 'SQL fragment that replaces the token when this element is chosen.',
                    },
                  },
                },
              },
            },
          },
        },
        column_expression_keys: {
          type: 'array',
          uniqueItems: true,
          items: {
            type: 'string',
          },
        },
        precision: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['key', 'value'],
            properties: {
              key: {
                type: 'string',
                description: 'the name of the column in column_expressions',
              },
              value: {
                type: 'number',
                description: 'Decimals for the specified key.',
              },
            },
          },
        },
      },
    },
  },
} as const;
