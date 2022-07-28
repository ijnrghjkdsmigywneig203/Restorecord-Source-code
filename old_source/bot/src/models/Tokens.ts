import { PrimaryColumn, Column, Entity } from "typeorm";

@Entity("tokens")
export class Token {
    @PrimaryColumn({ type: "varchar", length: 22 })
    user!: string;

    @Column({ type: "text" })
    accessToken: string;

    @Column({ type: "text" })
    refreshToken: string;
}