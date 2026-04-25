import { render, screen, fireEvent } from "@testing-library/react";

import GravatarSection from "@/components/settings/GravatarSection";

function getCheckboxInput(): HTMLInputElement {
  const span = screen.getByTestId("profile-gravatar-toggle");
  return span.querySelector('input[type="checkbox"]') as HTMLInputElement;
}

function renderSection(props: { useGravatar?: boolean; disabled?: boolean; onChange?: (v: boolean) => void } = {}) {
  return render(
    <GravatarSection
      useGravatar={props.useGravatar ?? false}
      disabled={props.disabled ?? false}
      onChange={props.onChange ?? jest.fn()}
    />
  );
}

describe("GravatarSection — rendering", () => {
  test("renders toggle switch", () => {
    renderSection();
    expect(screen.getByTestId("profile-gravatar-toggle")).toBeInTheDocument();
  });

  test("switch reflects useGravatar=false", () => {
    renderSection({ useGravatar: false });
    expect(getCheckboxInput()).not.toBeChecked();
  });

  test("switch reflects useGravatar=true", () => {
    renderSection({ useGravatar: true });
    expect(getCheckboxInput()).toBeChecked();
  });

  test("switch is disabled when disabled=true", () => {
    renderSection({ disabled: true });
    expect(getCheckboxInput()).toBeDisabled();
  });

  test("switch is enabled when disabled=false", () => {
    renderSection({ disabled: false });
    expect(getCheckboxInput()).not.toBeDisabled();
  });
});

describe("GravatarSection — onChange callback", () => {
  test("calls onChange with true when switch is toggled on", () => {
    const onChange = jest.fn();
    renderSection({ useGravatar: false, onChange });
    fireEvent.click(getCheckboxInput());
    expect(onChange).toHaveBeenCalledWith(true);
  });

  test("calls onChange with false when switch is toggled off", () => {
    const onChange = jest.fn();
    renderSection({ useGravatar: true, onChange });
    fireEvent.click(getCheckboxInput());
    expect(onChange).toHaveBeenCalledWith(false);
  });

});
