"use client";
import { useState } from "react";
import type { InputHTMLAttributes } from "react";

type Props=InputHTMLAttributes<HTMLInputElement>&{label:string};
export default function PasswordField({label,id,...props}:Props){const[visible,setVisible]=useState(false);const inputId=id||label.toLowerCase().replace(/[^a-z0-9]+/g,"-");return <div className="form-group"><label htmlFor={inputId}>{label}</label><div className="password-field"><input {...props} id={inputId} type={visible?"text":"password"}/><button type="button" onClick={()=>setVisible(v=>!v)} aria-label={visible?`Hide ${label}`:`Show ${label}`} aria-pressed={visible}>{visible?"Hide":"Show"}</button></div></div>}
