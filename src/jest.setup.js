/* global jest */

jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  const FontAwesome = ({ name, ...props }) =>
    React.createElement(Text, props, name);
  FontAwesome.font = {};
  return { FontAwesome };
});
