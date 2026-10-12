/* eslint-disable */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      daily_habits: {
        Row: {
          date: string;
          habit_id: string;
          percent_complete: number | null;
          steps: number;
          steps_complete: number;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          date: string;
          habit_id: string;
          percent_complete?: never;
          steps: number;
          steps_complete?: number;
          user_id?: string;
        };
        Update: {
          date?: string;
          habit_id?: string;
          percent_complete?: never;
          steps?: number;
          steps_complete?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "daily_habits_habit_id_fkey";
            columns: ["habit_id"];
            isOneToOne: false;
            referencedRelation: "habits";
            referencedColumns: ["id"];
          },
        ];
      };
      focus_blocks: {
        Row: {
          created_at: string;
          date: string;
          id: string;
          remaining_seconds: number;
          resumed_at: string | null;
          status: Database["public"]["Enums"]["focus_block_status"];
          task_id: string;
          total_seconds: number;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          date: string;
          id?: string;
          remaining_seconds: number;
          resumed_at?: string | null;
          status?: Database["public"]["Enums"]["focus_block_status"];
          task_id: string;
          total_seconds: number;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          date?: string;
          id?: string;
          remaining_seconds?: number;
          resumed_at?: string | null;
          status?: Database["public"]["Enums"]["focus_block_status"];
          task_id?: string;
          total_seconds?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "focus_blocks_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      goals: {
        Row: {
          created_at: string;
          id: string;
          is_archived: boolean;
          title: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          is_archived?: boolean;
          title?: string | null;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_archived?: boolean;
          title?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      habits: {
        Row: {
          created_at: string;
          days_active: number[];
          emoji: string;
          id: string;
          is_archived: boolean;
          is_paused: boolean;
          steps: number;
          title: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          days_active: number[];
          emoji: string;
          id?: string;
          is_archived?: boolean;
          is_paused?: boolean;
          steps: number;
          title: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          days_active?: number[];
          emoji?: string;
          id?: string;
          is_archived?: boolean;
          is_paused?: boolean;
          steps?: number;
          title?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      horoscopes: {
        Row: {
          created_at: string;
          date: string;
          overall_rating: number;
          rating_career: number;
          rating_communication: number;
          rating_creativity: number;
          rating_finance: number;
          rating_health: number;
          rating_home: number;
          rating_identity: number;
          rating_learning: number;
          rating_love: number;
          rating_relationships: number;
          rating_spirituality: number;
          rating_travel: number;
          sentiment: Database["public"]["Enums"]["horoscope_sentiment"];
          sun_sign: Database["public"]["Enums"]["sun_sign"];
          text: string;
          tips: string[];
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          date: string;
          overall_rating: number;
          rating_career: number;
          rating_communication: number;
          rating_creativity: number;
          rating_finance: number;
          rating_health: number;
          rating_home: number;
          rating_identity: number;
          rating_learning: number;
          rating_love: number;
          rating_relationships: number;
          rating_spirituality: number;
          rating_travel: number;
          sentiment?: never;
          sun_sign: Database["public"]["Enums"]["sun_sign"];
          text: string;
          tips?: string[];
        };
        Update: {
          created_at?: string;
          date?: string;
          overall_rating?: number;
          rating_career?: number;
          rating_communication?: number;
          rating_creativity?: number;
          rating_finance?: number;
          rating_health?: number;
          rating_home?: number;
          rating_identity?: number;
          rating_learning?: number;
          rating_love?: number;
          rating_relationships?: number;
          rating_spirituality?: number;
          rating_travel?: number;
          sentiment?: never;
          sun_sign?: Database["public"]["Enums"]["sun_sign"];
          text?: string;
          tips?: string[];
        };
        Relationships: [];
      };
      journals: {
        Row: {
          created_at: string;
          date: string;
          mood: number | null;
          prompts: NonNullable<Json>;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          date: string;
          mood?: number | null;
          prompts?: NonNullable<Json>;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          date?: string;
          mood?: number | null;
          prompts?: NonNullable<Json>;
          user_id?: string;
        };
        Relationships: [];
      };
      lists: {
        Row: {
          created_at: string;
          emoji: string;
          id: string;
          is_archived: boolean;
          title: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          emoji: string;
          id?: string;
          is_archived?: boolean;
          title?: string | null;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          emoji?: string;
          id?: string;
          is_archived?: boolean;
          title?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      notes: {
        Row: {
          content: string;
          created_at: string;
          date: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          content?: string;
          created_at?: string;
          date: string;
          user_id?: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          date?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      preferences: {
        Row: {
          alarm_sound: string;
          breath_count: number;
          breathing_technique: string;
          calendar_end_time: string;
          calendar_start_time: string;
          calendar_urls: string[];
          dark_theme: string;
          enable_calendar: boolean;
          enable_habits: boolean;
          enable_horoscope: boolean;
          enable_journal: boolean;
          enable_notes: boolean;
          focus_block_minutes: number;
          light_theme: string;
          sun_sign: Database["public"]["Enums"]["sun_sign"] | null;
          template_note: string;
          template_prompts: NonNullable<Json>;
          theme_mode: number;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          alarm_sound?: string;
          breath_count?: number;
          breathing_technique?: string;
          calendar_end_time?: string;
          calendar_start_time?: string;
          calendar_urls?: string[];
          dark_theme?: string;
          enable_calendar?: boolean;
          enable_habits?: boolean;
          enable_horoscope?: boolean;
          enable_journal?: boolean;
          enable_notes?: boolean;
          focus_block_minutes?: number;
          light_theme?: string;
          sun_sign?: Database["public"]["Enums"]["sun_sign"] | null;
          template_note?: string;
          template_prompts?: NonNullable<Json>;
          theme_mode?: number;
          user_id?: string;
        };
        Update: {
          alarm_sound?: string;
          breath_count?: number;
          breathing_technique?: string;
          calendar_end_time?: string;
          calendar_start_time?: string;
          calendar_urls?: string[];
          dark_theme?: string;
          enable_calendar?: boolean;
          enable_habits?: boolean;
          enable_horoscope?: boolean;
          enable_journal?: boolean;
          enable_notes?: boolean;
          focus_block_minutes?: number;
          light_theme?: string;
          sun_sign?: Database["public"]["Enums"]["sun_sign"] | null;
          template_note?: string;
          template_prompts?: NonNullable<Json>;
          theme_mode?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      repeat_task_templates: {
        Row: {
          alarm_time: string | null;
          created_at: string;
          goal_id: string | null;
          id: string;
          list_id: string | null;
          priority: number;
          schedule: string | null;
          subtasks: NonNullable<Json>;
          title: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          alarm_time?: string | null;
          created_at?: string;
          goal_id?: string | null;
          id?: string;
          list_id?: string | null;
          priority?: number;
          schedule?: string | null;
          subtasks?: NonNullable<Json>;
          title?: string;
          user_id?: string;
        };
        Update: {
          alarm_time?: string | null;
          created_at?: string;
          goal_id?: string | null;
          id?: string;
          list_id?: string | null;
          priority?: number;
          schedule?: string | null;
          subtasks?: NonNullable<Json>;
          title?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "repeat_task_templates_goal_id_fkey";
            columns: ["goal_id"];
            isOneToOne: false;
            referencedRelation: "goals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "repeat_task_templates_list_id_fkey";
            columns: ["list_id"];
            isOneToOne: false;
            referencedRelation: "lists";
            referencedColumns: ["id"];
          },
        ];
      };
      tasks: {
        Row: {
          alarm_time: string | null;
          created_at: string;
          due_on: string | null;
          goal_id: string | null;
          id: string;
          list_id: string | null;
          priority: number;
          scheduled_for: string | null;
          status: number;
          subtasks: NonNullable<Json>;
          template_id: string | null;
          title: string;
          url: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          alarm_time?: string | null;
          created_at?: string;
          due_on?: string | null;
          goal_id?: string | null;
          id?: string;
          list_id?: string | null;
          priority?: number;
          scheduled_for?: string | null;
          status?: number;
          subtasks?: NonNullable<Json>;
          template_id?: string | null;
          title?: string;
          url?: string | null;
          user_id?: string;
        };
        Update: {
          alarm_time?: string | null;
          created_at?: string;
          due_on?: string | null;
          goal_id?: string | null;
          id?: string;
          list_id?: string | null;
          priority?: number;
          scheduled_for?: string | null;
          status?: number;
          subtasks?: NonNullable<Json>;
          template_id?: string | null;
          title?: string;
          url?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_goal_id_fkey";
            columns: ["goal_id"];
            isOneToOne: false;
            referencedRelation: "goals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_list_id_fkey";
            columns: ["list_id"];
            isOneToOne: false;
            referencedRelation: "lists";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "repeat_task_templates";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      delete_user: { Args: Record<PropertyKey, never>; Returns: undefined };
      horoscope_sentiment_from_ratings: {
        Args: { ratings: number[] };
        Returns: Database["public"]["Enums"]["horoscope_sentiment"];
      };
      search_entries: {
        Args: { query: string };
        Returns: {
          content: string;
          entry_date: string;
          kind: string;
          prompt: string;
          task: Json;
        }[];
      };
      trigger_generate_horoscopes: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
    };
    Enums: {
      focus_block_status: "active" | "paused" | "complete" | "cancelled";
      horoscope_sentiment: "positive" | "negative" | "mixed";
      sun_sign:
        | "aries"
        | "taurus"
        | "gemini"
        | "cancer"
        | "leo"
        | "virgo"
        | "libra"
        | "scorpio"
        | "sagittarius"
        | "capricorn"
        | "aquarius"
        | "pisces";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null;
          avif_autodetection: boolean | null;
          created_at: string | null;
          file_size_limit: number | null;
          id: string;
          lifecycle_configuration: Json | null;
          lifecycle_configuration_generation: string | null;
          name: string;
          owner: string | null;
          owner_id: string | null;
          public: boolean | null;
          type: Database["storage"]["Enums"]["buckettype"];
          updated_at: string | null;
          versioning_status: string;
        };
        ComputedFields: never;
        Insert: {
          allowed_mime_types?: string[] | null;
          avif_autodetection?: boolean | null;
          created_at?: string | null;
          file_size_limit?: number | null;
          id: string;
          lifecycle_configuration?: Json | null;
          lifecycle_configuration_generation?: string | null;
          name: string;
          owner?: string | null;
          owner_id?: string | null;
          public?: boolean | null;
          type?: Database["storage"]["Enums"]["buckettype"];
          updated_at?: string | null;
          versioning_status?: string;
        };
        Update: {
          allowed_mime_types?: string[] | null;
          avif_autodetection?: boolean | null;
          created_at?: string | null;
          file_size_limit?: number | null;
          id?: string;
          lifecycle_configuration?: Json | null;
          lifecycle_configuration_generation?: string | null;
          name?: string;
          owner?: string | null;
          owner_id?: string | null;
          public?: boolean | null;
          type?: Database["storage"]["Enums"]["buckettype"];
          updated_at?: string | null;
          versioning_status?: string;
        };
        Relationships: [];
      };
      buckets_analytics: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          format: string;
          id: string;
          name: string;
          type: Database["storage"]["Enums"]["buckettype"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          format?: string;
          id?: string;
          name: string;
          type?: Database["storage"]["Enums"]["buckettype"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          format?: string;
          id?: string;
          name?: string;
          type?: Database["storage"]["Enums"]["buckettype"];
          updated_at?: string;
        };
        Relationships: [];
      };
      buckets_vectors: {
        Row: {
          created_at: string;
          id: string;
          type: Database["storage"]["Enums"]["buckettype"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id: string;
          type?: Database["storage"]["Enums"]["buckettype"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          type?: Database["storage"]["Enums"]["buckettype"];
          updated_at?: string;
        };
        Relationships: [];
      };
      iceberg_namespaces: {
        Row: {
          bucket_name: string;
          catalog_id: string;
          created_at: string;
          id: string;
          metadata: NonNullable<Json>;
          name: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          bucket_name: string;
          catalog_id: string;
          created_at?: string;
          id?: string;
          metadata?: NonNullable<Json>;
          name: string;
          updated_at?: string;
        };
        Update: {
          bucket_name?: string;
          catalog_id?: string;
          created_at?: string;
          id?: string;
          metadata?: NonNullable<Json>;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "iceberg_namespaces_catalog_id_fkey";
            columns: ["catalog_id"];
            isOneToOne: false;
            referencedRelation: "buckets_analytics";
            referencedColumns: ["id"];
          },
        ];
      };
      iceberg_tables: {
        Row: {
          bucket_name: string;
          catalog_id: string;
          created_at: string;
          id: string;
          location: string;
          name: string;
          namespace_id: string;
          remote_table_id: string | null;
          shard_id: string | null;
          shard_key: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          bucket_name: string;
          catalog_id: string;
          created_at?: string;
          id?: string;
          location: string;
          name: string;
          namespace_id: string;
          remote_table_id?: string | null;
          shard_id?: string | null;
          shard_key?: string | null;
          updated_at?: string;
        };
        Update: {
          bucket_name?: string;
          catalog_id?: string;
          created_at?: string;
          id?: string;
          location?: string;
          name?: string;
          namespace_id?: string;
          remote_table_id?: string | null;
          shard_id?: string | null;
          shard_key?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "iceberg_tables_catalog_id_fkey";
            columns: ["catalog_id"];
            isOneToOne: false;
            referencedRelation: "buckets_analytics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "iceberg_tables_namespace_id_fkey";
            columns: ["namespace_id"];
            isOneToOne: false;
            referencedRelation: "iceberg_namespaces";
            referencedColumns: ["id"];
          },
        ];
      };
      migrations: {
        Row: {
          executed_at: string | null;
          hash: string;
          id: number;
          name: string;
        };
        ComputedFields: never;
        Insert: {
          executed_at?: string | null;
          hash: string;
          id: number;
          name: string;
        };
        Update: {
          executed_at?: string | null;
          hash?: string;
          id?: number;
          name?: string;
        };
        Relationships: [];
      };
      objects: {
        Row: {
          archived_at: string | null;
          bucket_id: string | null;
          created_at: string | null;
          id: string;
          is_delete_marker: boolean;
          is_versioned: boolean;
          last_accessed_at: string | null;
          metadata: Json | null;
          name: string | null;
          owner: string | null;
          owner_id: string | null;
          path_tokens: string[] | null;
          updated_at: string | null;
          user_metadata: Json | null;
          version: string | null;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          bucket_id?: string | null;
          created_at?: string | null;
          id?: string;
          is_delete_marker?: boolean;
          is_versioned?: boolean;
          last_accessed_at?: string | null;
          metadata?: Json | null;
          name?: string | null;
          owner?: string | null;
          owner_id?: string | null;
          path_tokens?: never;
          updated_at?: string | null;
          user_metadata?: Json | null;
          version?: string | null;
        };
        Update: {
          archived_at?: string | null;
          bucket_id?: string | null;
          created_at?: string | null;
          id?: string;
          is_delete_marker?: boolean;
          is_versioned?: boolean;
          last_accessed_at?: string | null;
          metadata?: Json | null;
          name?: string | null;
          owner?: string | null;
          owner_id?: string | null;
          path_tokens?: never;
          updated_at?: string | null;
          user_metadata?: Json | null;
          version?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey";
            columns: ["bucket_id"];
            isOneToOne: false;
            referencedRelation: "buckets";
            referencedColumns: ["id"];
          },
        ];
      };
      s3_multipart_uploads: {
        Row: {
          bucket_id: string;
          created_at: string;
          id: string;
          in_progress_size: number;
          key: string;
          metadata: Json | null;
          owner_id: string | null;
          upload_signature: string;
          user_metadata: Json | null;
          version: string;
        };
        ComputedFields: never;
        Insert: {
          bucket_id: string;
          created_at?: string;
          id: string;
          in_progress_size?: number;
          key: string;
          metadata?: Json | null;
          owner_id?: string | null;
          upload_signature: string;
          user_metadata?: Json | null;
          version: string;
        };
        Update: {
          bucket_id?: string;
          created_at?: string;
          id?: string;
          in_progress_size?: number;
          key?: string;
          metadata?: Json | null;
          owner_id?: string | null;
          upload_signature?: string;
          user_metadata?: Json | null;
          version?: string;
        };
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey";
            columns: ["bucket_id"];
            isOneToOne: false;
            referencedRelation: "buckets";
            referencedColumns: ["id"];
          },
        ];
      };
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string;
          created_at: string;
          etag: string;
          id: string;
          key: string;
          owner_id: string | null;
          part_number: number;
          size: number;
          upload_id: string;
          version: string;
        };
        ComputedFields: never;
        Insert: {
          bucket_id: string;
          created_at?: string;
          etag: string;
          id?: string;
          key: string;
          owner_id?: string | null;
          part_number: number;
          size?: number;
          upload_id: string;
          version: string;
        };
        Update: {
          bucket_id?: string;
          created_at?: string;
          etag?: string;
          id?: string;
          key?: string;
          owner_id?: string | null;
          part_number?: number;
          size?: number;
          upload_id?: string;
          version?: string;
        };
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey";
            columns: ["bucket_id"];
            isOneToOne: false;
            referencedRelation: "buckets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey";
            columns: ["upload_id"];
            isOneToOne: false;
            referencedRelation: "s3_multipart_uploads";
            referencedColumns: ["id"];
          },
        ];
      };
      vector_indexes: {
        Row: {
          bucket_id: string;
          created_at: string;
          data_type: string;
          dimension: number;
          distance_metric: string;
          id: string;
          metadata_configuration: Json | null;
          name: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          bucket_id: string;
          created_at?: string;
          data_type: string;
          dimension: number;
          distance_metric: string;
          id?: string;
          metadata_configuration?: Json | null;
          name: string;
          updated_at?: string;
        };
        Update: {
          bucket_id?: string;
          created_at?: string;
          data_type?: string;
          dimension?: number;
          distance_metric?: string;
          id?: string;
          metadata_configuration?: Json | null;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vector_indexes_bucket_id_fkey";
            columns: ["bucket_id"];
            isOneToOne: false;
            referencedRelation: "buckets_vectors";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      allow_any_operation: {
        Args: { expected_operations: string[] };
        Returns: boolean;
      };
      allow_only_operation: {
        Args: { expected_operation: string };
        Returns: boolean;
      };
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string };
        Returns: undefined;
      };
      extension: { Args: { name: string }; Returns: string };
      filename: { Args: { name: string }; Returns: string };
      foldername: { Args: { name: string }; Returns: string[] };
      get_common_prefix: {
        Args: { p_delimiter: string; p_key: string; p_prefix: string };
        Returns: string;
      };
      get_size_by_bucket: {
        Args: { delete_markers?: string; noncurrent_versions?: string };
        Returns: {
          bucket_id: string;
          size: number;
        }[];
      };
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string;
          delimiter_param: string;
          max_keys?: number;
          next_key_token?: string;
          next_upload_token?: string;
          prefix_param: string;
          raw_prefix_param?: string;
        };
        Returns: {
          created_at: string;
          id: string;
          key: string;
        }[];
      };
      list_objects_with_delimiter: {
        Args: {
          _bucket_id: string;
          delete_markers?: string;
          delimiter_param: string;
          max_keys?: number;
          next_token?: string;
          next_token_archived_at?: string;
          next_token_version?: string;
          noncurrent_versions?: string;
          prefix_param: string;
          sort_order?: string;
          start_after?: string;
        };
        Returns: {
          archived_at: string;
          created_at: string;
          id: string;
          is_delete_marker: boolean;
          is_versioned: boolean;
          last_accessed_at: string;
          metadata: Json;
          name: string;
          updated_at: string;
          version: string;
        }[];
      };
      operation: { Args: Record<PropertyKey, never>; Returns: string };
      search: {
        Args: {
          bucketname: string;
          delete_markers?: string;
          levels?: number;
          limits?: number;
          noncurrent_versions?: string;
          offsets?: number;
          prefix: string;
          search?: string;
          sortcolumn?: string;
          sortorder?: string;
        };
        Returns: {
          archived_at: string;
          created_at: string;
          id: string;
          is_delete_marker: boolean;
          is_versioned: boolean;
          last_accessed_at: string;
          metadata: Json;
          name: string;
          updated_at: string;
          version: string;
        }[];
      };
      search_by_timestamp: {
        Args: {
          delete_markers?: string;
          noncurrent_versions?: string;
          p_bucket_id: string;
          p_level: number;
          p_limit: number;
          p_prefix: string;
          p_sort_column: string;
          p_sort_column_after: string;
          p_sort_order: string;
          p_start_after: string;
          p_start_after_version?: string;
        };
        Returns: {
          archived_at: string;
          created_at: string;
          id: string;
          is_delete_marker: boolean;
          is_versioned: boolean;
          key: string;
          last_accessed_at: string;
          metadata: Json;
          name: string;
          updated_at: string;
          version: string;
        }[];
      };
      search_v2: {
        Args: {
          bucket_name: string;
          delete_markers?: string;
          levels?: number;
          limits?: number;
          noncurrent_versions?: string;
          prefix: string;
          sort_column?: string;
          sort_column_after?: string;
          sort_order?: string;
          start_after?: string;
          start_after_archived_at?: string;
          start_after_is_continuation?: boolean;
          start_after_version?: string;
        };
        Returns: {
          archived_at: string;
          created_at: string;
          id: string;
          is_delete_marker: boolean;
          is_versioned: boolean;
          key: string;
          last_accessed_at: string;
          metadata: Json;
          name: string;
          updated_at: string;
          version: string;
        }[];
      };
    };
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS" | "VECTOR";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      focus_block_status: ["active", "paused", "complete", "cancelled"],
      horoscope_sentiment: ["positive", "negative", "mixed"],
      sun_sign: [
        "aries",
        "taurus",
        "gemini",
        "cancer",
        "leo",
        "virgo",
        "libra",
        "scorpio",
        "sagittarius",
        "capricorn",
        "aquarius",
        "pisces",
      ],
    },
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS", "VECTOR"],
    },
  },
} as const;
