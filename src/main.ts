import { createApp } from "vue";
import { createPinia } from "pinia";
import { addIcon } from "@iconify/vue";
import python from "@iconify-icons/logos/python";
import arrowsClockwise from "@iconify-icons/ph/arrows-clockwise";
import bookOpen from "@iconify-icons/ph/book-open";
import bracketsCurly from "@iconify-icons/ph/brackets-curly";
import caretRight from "@iconify-icons/ph/caret-right";
import caretUpFill from "@iconify-icons/ph/caret-up-fill";
import circle from "@iconify-icons/ph/circle";
import clock from "@iconify-icons/ph/clock";
import cube from "@iconify-icons/ph/cube";
import crownFill from "@iconify-icons/ph/crown-fill";
import database from "@iconify-icons/ph/database";
import databaseFill from "@iconify-icons/ph/database-fill";
import dotsThreeVertical from "@iconify-icons/ph/dots-three-vertical";
import gear from "@iconify-icons/ph/gear";
import gearSix from "@iconify-icons/ph/gear-six";
import houseFill from "@iconify-icons/ph/house-fill";
import keyFill from "@iconify-icons/ph/key-fill";
import lightningFill from "@iconify-icons/ph/lightning-fill";
import minus from "@iconify-icons/ph/minus";
import monitor from "@iconify-icons/ph/monitor";
import paletteFill from "@iconify-icons/ph/palette-fill";
import packageIcon from "@iconify-icons/ph/package";
import plusCircleFill from "@iconify-icons/ph/plus-circle-fill";
import rocketLaunch from "@iconify-icons/ph/rocket-launch";
import sealCheckFill from "@iconify-icons/ph/seal-check-fill";
import slidersHorizontal from "@iconify-icons/ph/sliders-horizontal";
import square from "@iconify-icons/ph/square";
import sparkleFill from "@iconify-icons/ph/sparkle-fill";
import windowsLogoFill from "@iconify-icons/ph/windows-logo-fill";
import x from "@iconify-icons/ph/x";
import App from "./App.vue";
import "./styles.css";
import "./form.css";

const icons = {
  "logos:python": python,
  "ph:arrows-clockwise": arrowsClockwise,
  "ph:book-open": bookOpen,
  "ph:brackets-curly": bracketsCurly,
  "ph:caret-right": caretRight,
  "ph:caret-up-fill": caretUpFill,
  "ph:circle": circle,
  "ph:clock": clock,
  "ph:cube": cube,
  "ph:crown-fill": crownFill,
  "ph:database": database,
  "ph:database-fill": databaseFill,
  "ph:dots-three-vertical": dotsThreeVertical,
  "ph:gear": gear,
  "ph:gear-six": gearSix,
  "ph:house-fill": houseFill,
  "ph:key-fill": keyFill,
  "ph:lightning-fill": lightningFill,
  "ph:minus": minus,
  "ph:monitor": monitor,
  "ph:palette-fill": paletteFill,
  "ph:package": packageIcon,
  "ph:plus-circle-fill": plusCircleFill,
  "ph:rocket-launch": rocketLaunch,
  "ph:seal-check-fill": sealCheckFill,
  "ph:sliders-horizontal": slidersHorizontal,
  "ph:square": square,
  "ph:sparkle-fill": sparkleFill,
  "ph:windows-logo-fill": windowsLogoFill,
  "ph:x": x,
};

Object.entries(icons).forEach(([name, icon]) => addIcon(name, icon));

createApp(App).use(createPinia()).mount("#app");
