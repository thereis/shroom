import { IRoomContext } from "../interfaces/IRoomContext";
import { IRoomObject } from "../interfaces/IRoomObject";

export abstract class RoomObject implements IRoomObject {
  private _context: IRoomContext | undefined;
  private _isDestroyed: boolean = false;

  protected get mounted() {
    return this._context != null;
  }

  protected get room() {
    return this.getRoomContext().room;
  }

  protected get configuration() {
    return this.getRoomContext().configuration;
  }

  protected get furnitureLoader() {
    return this.getRoomContext().furnitureLoader;
  }

  protected get animationTicker() {
    return this.getRoomContext().animationTicker;
  }

  protected get visualization() {
    return this.getRoomContext().visualization;
  }

  protected get geometry() {
    return this.getRoomContext().geometry;
  }

  protected get roomObjectContainer() {
    return this.getRoomContext().roomObjectContainer;
  }

  protected get avatarLoader() {
    return this.getRoomContext().avatarLoader;
  }

  protected get hitDetection() {
    return this.getRoomContext().hitDetection;
  }

  protected get tilemap() {
    return this.getRoomContext().tilemap;
  }

  protected get landscapeContainer() {
    return this.getRoomContext().landscapeContainer;
  }

  protected get application() {
    return this.getRoomContext().application;
  }

  protected getRoomContext(): IRoomContext {
    if (this._context == null) throw new Error("Invalid context");

    return this._context;
  }

  setParent(room: IRoomContext): void {
    if (this._context != null)
      throw new Error("RoomObject already provided with a context.");

    this._isDestroyed = false;
    this._context = room;

    this.registered();
  }

  destroy() {
    if (this._isDestroyed) return;

    // Important: set isDestroyed to true so this doesn't infinite loop.
    this._isDestroyed = true;

    this.roomObjectContainer.removeRoomObject(this);

    this._context = undefined;
    this.destroyed();
  }

  abstract destroyed(): void;
  abstract registered(): void;
}
