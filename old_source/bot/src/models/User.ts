import { PrimaryColumn, Column, Entity } from "typeorm";

@Entity("users")
export class RestoreUser {
    @PrimaryColumn({ type: "varchar", length: 22 })
    user!: string;

    @Column({ type: "text", nullable: true })
    redirectUri?: string;

    @Column({ type: "text", default: "[]" })
    tiedUsers: string;
}