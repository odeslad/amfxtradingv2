-- Spec 033 · Mirror presets. The single mirror configuration becomes the "Default" preset.

CREATE TABLE "mirror_presets" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "brokers" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mirror_presets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mirror_presets_name_key" ON "mirror_presets"("name");

INSERT INTO "mirror_presets" ("name", "position", "brokers", "updatedAt")
SELECT 'Default', 0,
       COALESCE(
         (SELECT jsonb_agg(jsonb_build_object(
                   'broker', "broker", 'enabled', "enabled", 'lotsMode', "lotsMode", 'lots', "lots")
                 ORDER BY "broker")
          FROM "settings_mirror"),
         '[]'::jsonb),
       CURRENT_TIMESTAMP;

DROP TABLE "settings_mirror";
