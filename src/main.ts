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
import database from "@iconify-icons/ph/database";
import databaseFill from "@iconify-icons/ph/database-fill";
import dotsThreeVertical from "@iconify-icons/ph/dots-three-vertical";
import gear from "@iconify-icons/ph/gear";
import gearSix from "@iconify-icons/ph/gear-six";
import houseFill from "@iconify-icons/ph/house-fill";
import minus from "@iconify-icons/ph/minus";
import monitor from "@iconify-icons/ph/monitor";
import packageIcon from "@iconify-icons/ph/package";
import plusCircleFill from "@iconify-icons/ph/plus-circle-fill";
import rocketLaunch from "@iconify-icons/ph/rocket-launch";
import slidersHorizontal from "@iconify-icons/ph/sliders-horizontal";
import square from "@iconify-icons/ph/square";
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
  "ph:database": database,
  "ph:database-fill": databaseFill,
  "ph:dots-three-vertical": dotsThreeVertical,
  "ph:gear": gear,
  "ph:gear-six": gearSix,
  "ph:house-fill": houseFill,
  "ph:minus": minus,
  "ph:monitor": monitor,
  "ph:package": packageIcon,
  "ph:plus-circle-fill": plusCircleFill,
  "ph:rocket-launch": rocketLaunch,
  "ph:sliders-horizontal": slidersHorizontal,
  "ph:square": square,
  "ph:windows-logo-fill": windowsLogoFill,
  "ph:x": x,
};

Object.entries(icons).forEach(([name, icon]) => addIcon(name, icon));

createApp(App).use(createPinia()).mount("#app");
