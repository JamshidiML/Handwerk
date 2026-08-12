"use client";

import type { EntityId, UserId } from "@handwerk/contracts";
import { AudioCapture, type AudioCaptureProps } from "./AudioCapture";
import styles from "./Capture.module.css";
import {
  MeasurementEntry,
  type MeasurementEntryProps,
} from "./MeasurementEntry";
import { PhotoCapture, type PhotoCaptureProps } from "./PhotoCapture";

export interface CaptureWorkspaceProps {
  readonly audio: Omit<AudioCaptureProps, "onUpload"> & {
    readonly onUpload: AudioCaptureProps["onUpload"];
  };
  readonly measurement: Pick<MeasurementEntryProps, "onAdd">;
  readonly photo: Omit<PhotoCaptureProps, "onUpload"> & {
    readonly onUpload: PhotoCaptureProps["onUpload"];
  };
  readonly siteVisitId: EntityId;
  readonly userId: UserId;
}

export function CaptureWorkspace({
  audio,
  measurement,
  photo,
  siteVisitId,
  userId,
}: CaptureWorkspaceProps) {
  return (
    <div className={styles.workspace} data-testid="capture-workspace">
      <AudioCapture {...audio} />
      <PhotoCapture {...photo} />
      <MeasurementEntry
        onAdd={measurement.onAdd}
        siteVisitId={siteVisitId}
        userId={userId}
      />
    </div>
  );
}
