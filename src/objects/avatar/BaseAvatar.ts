import { RoomObject } from "../RoomObject";
import * as PIXI from "pixi.js";
import {
  AvatarAsset,
  AvatarDrawDefinition,
  AvatarDrawPart,
} from "./util/getAvatarDrawDefinition";
import { LookOptions } from "./util/createLookServer";
import {
  AvatarLoaderResult,
  IAvatarLoader,
} from "../../interfaces/IAvatarLoader";
import { ClickHandler } from "../hitdetection/ClickHandler";
import { HitSprite } from "../hitdetection/HitSprite";
import { isSetEqual } from "../../util/isSetEqual";
import { IHitDetection } from "../../interfaces/IHitDetection";
import { IAnimationTicker } from "../../interfaces/IAnimationTicker";
import { Shroom } from "../Shroom";

interface Options {
  look: LookOptions;
  position: { x: number; y: number };
  zIndex: number;
}

export interface BaseAvatarDependencies {
  hitDetection: IHitDetection;
  animationTicker: IAnimationTicker;
  avatarLoader: IAvatarLoader;
}

export class BaseAvatar extends PIXI.Container {
  private _container: PIXI.Container | undefined;
  private _avatarLoaderResult: AvatarLoaderResult | undefined;
  private _avatarDrawDefinition: AvatarDrawDefinition | undefined;

  private _lookOptions: LookOptions | undefined;
  private _nextLookOptions: LookOptions | undefined;

  private _currentFrame: number = 0;
  private _clickHandler: ClickHandler = new ClickHandler();
  private _assets: HitSprite[] = [];

  private _refreshFrame = false;
  private _refreshLook = false;

  private _sprites: Map<string, HitSprite> = new Map();

  private _layer: "door" | "tile" = "tile";
  private _updateId = 0;

  private _dependencies?: BaseAvatarDependencies;

  public get dependencies() {
    if (this._dependencies == null)
      throw new Error("Invalid dependencies in BaseAvatar");

    return this._dependencies;
  }

  public set dependencies(value) {
    this._dependencies = value;
    this._handleDependenciesSet();
  }

  private get mounted() {
    return this._dependencies != null;
  }

  get onClick() {
    return this._clickHandler.onClick;
  }

  set onClick(value) {
    this._clickHandler.onClick = value;
  }

  get onDoubleClick() {
    return this._clickHandler.onDoubleClick;
  }

  set onDoubleClick(value) {
    this._clickHandler.onDoubleClick = value;
  }

  get lookOptions() {
    if (this._nextLookOptions != null) {
      return this._nextLookOptions;
    }

    if (this._lookOptions == null) throw new Error("Invalid look options");

    return this._lookOptions;
  }

  set lookOptions(lookOptions) {
    this._updateLookOptions(this._lookOptions, lookOptions);
  }

  get currentFrame() {
    return this._currentFrame;
  }

  set currentFrame(value) {
    if (value === this._currentFrame) {
      return;
    }

    this._currentFrame = value;
    this._refreshFrame = true;
  }

  constructor(options: Options) {
    super();
    this.x = options.position.x;
    this.y = options.position.y;
    this.zIndex = options.zIndex;
    this._nextLookOptions = options.look;
  }

  private _updateLookOptions(
    oldLookOptions: LookOptions | undefined,
    newLookOptions: LookOptions
  ) {
    if (
      oldLookOptions == null ||
      !isSetEqual(oldLookOptions.actions, newLookOptions.actions) ||
      oldLookOptions.look != newLookOptions.look ||
      oldLookOptions.item != newLookOptions.item ||
      oldLookOptions.effect != newLookOptions.effect ||
      oldLookOptions.direction != newLookOptions.direction
    ) {
      this._nextLookOptions = newLookOptions;
      this._refreshLook = true;
    }
  }

  private _positionChanged() {
    if (this._avatarDrawDefinition == null) return;
    this._updatePosition(this._avatarDrawDefinition);
  }

  private _updatePosition(definition: AvatarDrawDefinition) {
    if (this._container == null) return;

    this._container.x = definition.offsetX;
    this._container.y = definition.offsetY;
  }

  private _updateSprites() {
    if (this._avatarLoaderResult == null) return;
    if (this._lookOptions == null) return;

    const definition = this._avatarLoaderResult.getDrawDefinition(
      this._lookOptions
    );

    this._avatarDrawDefinition = definition;

    this._updateSpritesWithAvatarDrawDefinition(definition, this.currentFrame);
    this._updatePosition(definition);
  }

  private _updateSpritesWithAvatarDrawDefinition(
    drawDefinition: AvatarDrawDefinition,
    currentFrame: number
  ) {
    if (!this.mounted) return;

    this._assets.forEach((value) => {
      value.visible = false;
      value.ignore = true;
    });
    this._container?.destroy();

    this._container = new PIXI.Container();

    drawDefinition.parts.forEach((part) => {
      const frame = currentFrame % part.assets.length;
      const asset = part.assets[frame];

      let sprite = this._sprites.get(asset.fileId);

      if (sprite == null) {
        sprite = this.createAsset(part, asset);

        if (sprite != null) {
          this._assets.push(sprite);
        }
      }

      if (sprite == null) return;

      sprite.x = asset.x;
      sprite.y = asset.y;
      sprite.visible = true;
      sprite.mirrored = asset.mirror;
      sprite.ignore = false;

      this._sprites.set(asset.fileId, sprite);
      this._container?.addChild(sprite);
    });

    this.addChild(this._container);
  }

  private createAsset(part: AvatarDrawPart, asset: AvatarAsset) {
    if (this._avatarLoaderResult == null)
      throw new Error(
        "Cant create asset when avatar loader result not present"
      );
    const texture = this._avatarLoaderResult.getTexture(asset.fileId);

    if (texture == null) return;

    const sprite = new HitSprite({
      hitDetection: this.dependencies.hitDetection,
      mirrored: asset.mirror,
    });

    sprite.hitTexture = texture;

    sprite.x = asset.x;
    sprite.y = asset.y;
    sprite.addEventListener("click", (event) => {
      this._clickHandler.handleClick(event);
    });

    if (part.color != null && part.mode === "colored") {
      sprite.tint = parseInt(part.color.slice(1), 16);
    } else {
      sprite.tint = 0xffffff;
    }

    return sprite;
  }

  private _reloadLook() {
    if (!this.mounted) return;

    const lookOptions = this._nextLookOptions;

    if (lookOptions != null) {
      const requestId = ++this._updateId;

      this.dependencies.avatarLoader
        .getAvatarDrawDefinition({ ...lookOptions, initial: true })
        .then((result) => {
          if (requestId !== this._updateId) return;

          this._avatarLoaderResult = result;

          this._lookOptions = lookOptions;
          this._nextLookOptions = undefined;

          this._updateSprites();
        });
    }
  }

  private _updateFrame() {
    if (this._avatarDrawDefinition == null) return;

    this._updateSpritesWithAvatarDrawDefinition(
      this._avatarDrawDefinition,
      this.currentFrame
    );
    this._updatePosition(this._avatarDrawDefinition);
  }

  private _handleDependenciesSet(): void {
    this._reloadLook();

    this.dependencies.animationTicker.subscribe(() => {
      if (this._refreshLook) {
        this._refreshLook = false;
        this._reloadLook();
      }

      if (this._refreshFrame) {
        this._refreshFrame = false;
        this._updateFrame();
      }
    });
  }

  static fromShroom(shroom: Shroom, options: Options) {
    const avatar = new BaseAvatar({ ...options });
    avatar.dependencies = shroom.dependencies;
    return avatar;
  }

  destroy(): void {
    this._container?.destroy();
  }
}
