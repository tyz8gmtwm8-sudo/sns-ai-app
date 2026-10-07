"use client";
// AIへの指示の入力欄。よく使う指示はボタンで追加できる
import { useState } from "react";

type Props = {
  name?: string;
  placeholder: string;
  chips: string[]; // よく使う指示
  required?: boolean;
};

export function InstructionInput({ name = "instruction", placeholder, chips, required }: Props) {
  const [value, setValue] = useState("");

  // ボタンの指示を、入力欄の最後に「、」でつなげて追加する（同じ指示は2回入れない）
  const add = (chip: string) => setValue((v) => (v.includes(chip) ? v : v ? `${v}、${chip}` : chip));

  return (
    <div className="flex-1 space-y-2">
      <input
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="input"
        placeholder={placeholder}
        required={required}
      />
      <div className="flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => add(chip)}
            className={`rounded-full border px-2.5 py-0.5 text-xs transition ${
              value.includes(chip) ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 bg-white text-stone-700 hover:bg-stone-100"
            }`}
          >
            ＋{chip}
          </button>
        ))}
      </div>
    </div>
  );
}
